import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { redis } from '../../src/config/redis.js';
import { cacheService } from '../../src/bootstrap/url.bootstrap.js';

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';

  do {
    const [nextCursor, scannedKeys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100
    );

    cursor = nextCursor;
    keys.push(...scannedKeys);
  } while (cursor !== '0');

  return keys;
}

async function safeCleanupDbAndRedis() {
  const { rows } = await pool.query('SELECT current_database()');
  const activeDb = rows[0]?.current_database;

  if (activeDb !== 'url_shortener_test') {
    throw new Error(
      `SAFETY FAILURE: Refusing cleanup because active database is '${activeDb}', expected 'url_shortener_test'`
    );
  }

  await pool.query(
    'TRUNCATE TABLE urls, "session", "account", "user", "verification" RESTART IDENTITY CASCADE'
  );

  const rateLimitKeys = await scanKeys('ratelimit:*');
  if (rateLimitKeys.length > 0) {
    await redis.del(...rateLimitKeys);
  }

  await cacheService.flushTestKeys();
}

async function registerAndLogin(email: string, name: string) {
  const response = await request(app).post('/api/auth/sign-up/email').send({
    email,
    password: 'Password123!',
    name,
  });

  const cookies = response.get('Set-Cookie');
  return {
    user: response.body.user as { id: string; email: string },
    cookies: cookies!,
  };
}

describe('Rate Limiting Integration Tests (Real Redis & Real DB)', () => {
  beforeEach(async () => {
    await safeCleanupDbAndRedis();
  });

  describe('POST /api/v1/urls (Rate Limiting)', () => {
    it('should allow requests within rate limit and set X-RateLimit headers', async () => {
      const { cookies } = await registerAndLogin(
        'rl_user1@example.com',
        'RL User 1'
      );

      const res = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({ originalUrl: 'https://example.com/rl-test-1' });

      expect(res.status).toBe(201);
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should return 429 and Retry-After header when rate limit is exceeded', async () => {
      const { user, cookies } = await registerAndLogin(
        'rl_user2@example.com',
        'RL User 2'
      );

      const rateLimitKey = `ratelimit:create-url:${user.id}`;
      // Pre-fill Redis counter to 100 (matching default limit)
      await redis.set(rateLimitKey, '100', 'EX', 60);

      const res = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({ originalUrl: 'https://example.com/rl-exceeded' });

      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
      expect(res.body).toEqual({
        success: false,
        message: 'Too many requests, please try again later',
      });
    });

    it('should track rate limits independently for different authenticated users', async () => {
      const userA = await registerAndLogin('user_rl_a@example.com', 'User A');
      const userB = await registerAndLogin('user_rl_b@example.com', 'User B');

      // Fill user A's limit
      const keyA = `ratelimit:create-url:${userA.user.id}`;
      await redis.set(keyA, '100', 'EX', 60);

      const resA = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/blocked-a' });

      expect(resA.status).toBe(429);

      // User B should still succeed (201 Created)
      const resB = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userB.cookies)
        .send({ originalUrl: 'https://example.com/allowed-b' });

      expect(resB.status).toBe(201);
    });

    it('should fail open and allow request when Redis eval fails', async () => {
      const evalSpy = vi
        .spyOn(redis, 'eval')
        .mockRejectedValueOnce(new Error('Simulated Redis eval failure'));

      const { cookies } = await registerAndLogin(
        'rl_failopen@example.com',
        'FailOpen User'
      );

      const res = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({ originalUrl: 'https://example.com/rl-fail-open-test' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('shortCode');
      expect(res.headers['x-ratelimit-limit']).toBeDefined();

      evalSpy.mockRestore();
    });
  });

  describe('GET /api/v1/urls/:shortCode (Public Rate Limiting)', () => {
    it('should allow public request within limit and return 302 Found', async () => {
      const { cookies } = await registerAndLogin(
        'creator@example.com',
        'Creator'
      );
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({ originalUrl: 'https://example.com/resolve-target' });

      const shortCode = createRes.body.shortCode;

      const resolveRes = await request(app).get(`/api/v1/urls/${shortCode}`);

      expect(resolveRes.status).toBe(302);
      expect(resolveRes.headers['location']).toBe(
        'https://example.com/resolve-target'
      );
      expect(resolveRes.headers['x-ratelimit-limit']).toBeDefined();
      expect(resolveRes.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should return 429 when public resolution rate limit is exceeded', async () => {
      const { cookies } = await registerAndLogin(
        'creator2@example.com',
        'Creator 2'
      );
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({ originalUrl: 'https://example.com/resolve-target-2' });

      const shortCode = createRes.body.shortCode;

      // Make one request to generate the ratelimit key for the actual test runner IP
      const firstRes = await request(app).get(`/api/v1/urls/${shortCode}`);
      expect(firstRes.status).toBe(302);

      // Pre-fill public rate limit key for whatever IP Supertest used
      const keys = await scanKeys('ratelimit:resolve-url:*');
      for (const k of keys) {
        await redis.set(k, '100', 'EX', 60);
      }

      const resolveRes = await request(app).get(`/api/v1/urls/${shortCode}`);

      expect(resolveRes.status).toBe(429);
      expect(resolveRes.headers['retry-after']).toBeDefined();
      expect(resolveRes.body).toEqual({
        success: false,
        message: 'Too many requests, please try again later',
      });
    });

    it('should isolate ratelimit:* keys from url:* cache keys', async () => {
      const { cookies } = await registerAndLogin(
        'creator3@example.com',
        'Creator 3'
      );
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({ originalUrl: 'https://example.com/key-isolation' });

      const shortCode = createRes.body.shortCode;

      // Resolve once to cache in Redis
      await request(app).get(`/api/v1/urls/${shortCode}`);

      const rateLimitKeys = await scanKeys('ratelimit:*');
      const urlCacheKeys = await scanKeys('url:*');

      expect(rateLimitKeys.length).toBeGreaterThan(0);
      expect(urlCacheKeys).toContain(`url:${shortCode}`);

      // Verify ratelimit keys do not overlap with url cache keys
      for (const k of rateLimitKeys) {
        expect(k.startsWith('ratelimit:')).toBe(true);
        expect(k.startsWith('url:')).toBe(false);
      }
    });
  });
});

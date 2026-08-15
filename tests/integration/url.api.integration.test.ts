import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import pool from '../../src/config/database';
import { cacheService } from '../../src/bootstrap/url.bootstrap';

async function safeCleanupUrlTables() {
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

describe('API Integration Tests (Real PostgreSQL Test DB & Real Redis)', () => {
  beforeEach(async () => {
    await safeCleanupUrlTables();
  });

  describe('POST /api/v1/urls (Protected Route)', () => {
    it('should return 401 Unauthorized for unauthenticated POST', async () => {
      const response = await request(app)
        .post('/api/v1/urls')
        .send({ originalUrl: 'https://example.com/unauth-post' });

      expect(response.status).toBe(401);
    });

    it('should create short URL for authenticated user and store session.user.id in urls.user_id', async () => {
      const { user, cookies } = await registerAndLogin(
        'userA@example.com',
        'User A'
      );

      const response = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({ originalUrl: 'https://example.com/long-url-path' });

      expect(response.status).toBe(201);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('shortCode');
      expect(response.body).toHaveProperty(
        'originalUrl',
        'https://example.com/long-url-path'
      );

      const dbRes = await pool.query<{ user_id: string }>(
        'SELECT user_id FROM urls WHERE id = $1',
        [response.body.id]
      );
      expect(dbRes.rows[0]?.user_id).toBe(user.id);
    });

    it('should return 400 Bad Request for malformed URL', async () => {
      const { cookies } = await registerAndLogin(
        'user-malformed@example.com',
        'Malformed User'
      );

      const response = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({ originalUrl: 'not-a-valid-url' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body.errors).toHaveProperty('originalUrl');
    });

    it('should return 400 Bad Request for private/loopback SSRF hostnames', async () => {
      const { cookies } = await registerAndLogin(
        'user-ssrf@example.com',
        'SSRF User'
      );
      const privateUrls = [
        'http://localhost/admin',
        'http://127.0.0.1:8080/secret',
        'http://169.254.169.254/latest/meta-data/',
      ];

      for (const url of privateUrls) {
        const response = await request(app)
          .post('/api/v1/urls')
          .set('Cookie', cookies)
          .send({ originalUrl: url });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('should create short URL with valid customAlias for authenticated user', async () => {
      const { cookies } = await registerAndLogin(
        'user-alias@example.com',
        'Alias User'
      );
      const customAlias = 'myCustomAlias123';

      const response = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({
          originalUrl: 'https://example.com/alias-target',
          customAlias,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('shortCode', customAlias);
    });

    it('should return 409 Conflict when customAlias is already taken', async () => {
      const { cookies } = await registerAndLogin(
        'user-conflict@example.com',
        'Conflict User'
      );

      await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({
          originalUrl: 'https://example.com/first-target',
          customAlias: 'takenAlias123',
        });

      const response = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({
          originalUrl: 'https://example.com/second-target',
          customAlias: 'takenAlias123',
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        success: false,
        message: 'Custom alias is already in use',
      });
    });

    it('should create short URL with valid future expiresAt containing timezone offset', async () => {
      const { cookies } = await registerAndLogin(
        'user-exp@example.com',
        'Expiry User'
      );
      const expiresAt = '2026-12-31T23:59:59+05:30';

      const response = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({ originalUrl: 'https://example.com/exp-target', expiresAt });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body.expiresAt).not.toBeNull();
    });
  });

  describe('DELETE /api/v1/urls/:id (Protected Route & Ownership & Redis Invalidation)', () => {
    it('should return 401 Unauthorized for unauthenticated DELETE', async () => {
      const response = await request(app).delete(
        '/api/v1/urls/11111111-1111-1111-1111-111111111111'
      );

      expect(response.status).toBe(401);
    });

    it('should return 404 Not Found and NOT delete URL when User B attempts to delete User A URL', async () => {
      const userA = await registerAndLogin('userA@example.com', 'User A');
      const userB = await registerAndLogin('userB@example.com', 'User B');

      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/user-a-secret' });

      const urlId = createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/urls/${urlId}`)
        .set('Cookie', userB.cookies);

      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body).toEqual({
        success: false,
        message: 'Short URL not found',
      });

      const dbRes = await pool.query('SELECT id FROM urls WHERE id = $1', [
        urlId,
      ]);
      expect(dbRes.rows.length).toBe(1);
    });

    it('should return 204 No Content, delete URL from PostgreSQL, and invalidate Redis cache', async () => {
      const userA = await registerAndLogin('userA@example.com', 'User A');

      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/user-a-url' });

      const urlId = createRes.body.id;
      const shortCode = createRes.body.shortCode;

      // Populate Redis cache via first GET request
      const firstGetRes = await request(app).get(`/api/v1/urls/${shortCode}`);
      expect(firstGetRes.status).toBe(302);
      expect(await cacheService.get(shortCode)).toBe('https://example.com/user-a-url');

      // Delete URL
      const deleteRes = await request(app)
        .delete(`/api/v1/urls/${urlId}`)
        .set('Cookie', userA.cookies);

      expect(deleteRes.status).toBe(204);

      // Verify Redis cache key is invalidated
      expect(await cacheService.get(shortCode)).toBeNull();

      // Subsequent GET request returns 404
      const secondGetRes = await request(app).get(`/api/v1/urls/${shortCode}`);
      expect(secondGetRes.status).toBe(404);
    });
  });

  describe('GET /api/v1/urls (Protected Route & Pagination)', () => {
    it('should return 401 Unauthorized for unauthenticated GET /api/v1/urls', async () => {
      const response = await request(app).get('/api/v1/urls');
      expect(response.status).toBe(401);
    });

    it('should return empty paginated response when authenticated user has no URLs', async () => {
      const userEmpty = await registerAndLogin(
        'emptyuser@example.com',
        'Empty User'
      );

      const response = await request(app)
        .get('/api/v1/urls')
        .set('Cookie', userEmpty.cookies);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });
    });

    it('should filter strictly by user ownership (User A cannot see User B URLs)', async () => {
      const userA = await registerAndLogin('userA_list@example.com', 'User A');
      const userB = await registerAndLogin('userB_list@example.com', 'User B');

      await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/user-a-url-1' });

      await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/user-a-url-2' });

      await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userB.cookies)
        .send({ originalUrl: 'https://example.com/user-b-url-1' });

      const resA = await request(app)
        .get('/api/v1/urls')
        .set('Cookie', userA.cookies);

      expect(resA.status).toBe(200);
      expect(resA.body.pagination.total).toBe(2);
      expect(resA.body.data).toHaveLength(2);
      expect(
        resA.body.data.every((url: { userId: string }) => url.userId === userA.user.id)
      ).toBe(true);

      const resB = await request(app)
        .get('/api/v1/urls')
        .set('Cookie', userB.cookies);

      expect(resB.status).toBe(200);
      expect(resB.body.pagination.total).toBe(1);
      expect(resB.body.data).toHaveLength(1);
      expect(resB.body.data[0].userId).toBe(userB.user.id);
    });

    it('should return URLs ordered by created_at DESC, id DESC (newest first)', async () => {
      const userA = await registerAndLogin('user_order@example.com', 'Order User');

      const res1 = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/first-created' });

      const res2 = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/second-created' });

      const listRes = await request(app)
        .get('/api/v1/urls')
        .set('Cookie', userA.cookies);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data[0].id).toBe(res2.body.id);
      expect(listRes.body.data[1].id).toBe(res1.body.id);
    });

    it('should paginate correctly using page and limit query parameters', async () => {
      const userA = await registerAndLogin('user_page@example.com', 'Page User');

      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/v1/urls')
          .set('Cookie', userA.cookies)
          .send({ originalUrl: `https://example.com/page-item-${i}` });
      }

      const resPage1 = await request(app)
        .get('/api/v1/urls?page=1&limit=2')
        .set('Cookie', userA.cookies);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      expect(resPage1.body.data).toHaveLength(2);

      const resPage2 = await request(app)
        .get('/api/v1/urls?page=2&limit=2')
        .set('Cookie', userA.cookies);

      expect(resPage2.status).toBe(200);
      expect(resPage2.body.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      expect(resPage2.body.data).toHaveLength(1);
    });

    it('should preserve requested page when requesting page beyond available data', async () => {
      const userA = await registerAndLogin('user_beyond@example.com', 'Beyond User');

      await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/one-item' });

      const response = await request(app)
        .get('/api/v1/urls?page=5&limit=20')
        .set('Cookie', userA.cookies);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        pagination: {
          page: 5,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });
    });
  });

  describe('GET /api/v1/urls/:shortCode (Public Route & Redis Caching)', () => {
    it('should resolve URL via Cache MISS then serve subsequent requests via Cache HIT', async () => {
      const userA = await registerAndLogin('userA@example.com', 'User A');

      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/cached-redirect-target' });

      const shortCode = createRes.body.shortCode;

      // Verify key is initially not in Redis
      expect(await cacheService.get(shortCode)).toBeNull();

      // First resolution (Cache MISS -> PostgreSQL -> Cache SET)
      const res1 = await request(app).get(`/api/v1/urls/${shortCode}`);
      expect(res1.status).toBe(302);
      expect(res1.headers.location).toBe('https://example.com/cached-redirect-target');

      // Verify key is now cached in Redis
      expect(await cacheService.get(shortCode)).toBe('https://example.com/cached-redirect-target');

      // Second resolution (Cache HIT)
      const res2 = await request(app).get(`/api/v1/urls/${shortCode}`);
      expect(res2.status).toBe(302);
      expect(res2.headers.location).toBe('https://example.com/cached-redirect-target');
    });

    it('should return 410 Gone when short URL has expired', async () => {
      const pastDate = new Date(Date.now() - 60000);
      await pool.query(
        `INSERT INTO urls (id, original_url, short_code, created_at, expires_at)
         VALUES ($1, $2, $3, NOW(), $4)`,
        [
          '11111111-1111-1111-1111-111111111111',
          'https://example.com/expired-target',
          'expired123',
          pastDate,
        ]
      );

      const response = await request(app).get('/api/v1/urls/expired123');

      expect(response.status).toBe(410);
      expect(response.body).toEqual({
        success: false,
        message: 'URL has expired',
      });
      expect(await cacheService.get('expired123')).toBeNull();
    });

    it('should return 404 Not Found when short code does not exist', async () => {
      const response = await request(app).get('/api/v1/urls/noexist999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Short URL not found',
      });
    });
  });
});

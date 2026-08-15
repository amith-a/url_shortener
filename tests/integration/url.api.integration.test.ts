import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import pool from '../../src/config/database';

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

describe('API Integration Tests (Real PostgreSQL Test DB)', () => {
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

      // First insertion
      await request(app)
        .post('/api/v1/urls')
        .set('Cookie', cookies)
        .send({
          originalUrl: 'https://example.com/first-target',
          customAlias: 'takenAlias123',
        });

      // Second insertion with identical alias
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

  describe('DELETE /api/v1/urls/:id (Protected Route & Ownership)', () => {
    it('should return 401 Unauthorized for unauthenticated DELETE', async () => {
      const response = await request(app).delete(
        '/api/v1/urls/11111111-1111-1111-1111-111111111111'
      );

      expect(response.status).toBe(401);
    });

    it('should return 404 Not Found and NOT delete URL when User B attempts to delete User A URL', async () => {
      const userA = await registerAndLogin('userA@example.com', 'User A');
      const userB = await registerAndLogin('userB@example.com', 'User B');

      // User A creates a URL
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/user-a-secret' });

      const urlId = createRes.body.id;

      // User B attempts to delete User A's URL
      const deleteRes = await request(app)
        .delete(`/api/v1/urls/${urlId}`)
        .set('Cookie', userB.cookies);

      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body).toEqual({
        success: false,
        message: 'Short URL not found',
      });

      // Verify URL still exists in the database
      const dbRes = await pool.query('SELECT id FROM urls WHERE id = $1', [
        urlId,
      ]);
      expect(dbRes.rows.length).toBe(1);
    });

    it('should return 204 No Content and delete URL when User A deletes own URL', async () => {
      const userA = await registerAndLogin('userA@example.com', 'User A');

      // User A creates a URL
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/user-a-url' });

      const urlId = createRes.body.id;

      // User A deletes own URL
      const deleteRes = await request(app)
        .delete(`/api/v1/urls/${urlId}`)
        .set('Cookie', userA.cookies);

      expect(deleteRes.status).toBe(204);

      // Verify URL no longer exists in database
      const dbRes = await pool.query('SELECT id FROM urls WHERE id = $1', [
        urlId,
      ]);
      expect(dbRes.rows.length).toBe(0);
    });
  });

  describe('GET /api/v1/urls/:shortCode (Public Route)', () => {
    it('should allow public unauthenticated GET redirect (302 Found)', async () => {
      const userA = await registerAndLogin('userA@example.com', 'User A');

      const createRes = await request(app)
        .post('/api/v1/urls')
        .set('Cookie', userA.cookies)
        .send({ originalUrl: 'https://example.com/public-redirect-target' });

      const shortCode = createRes.body.shortCode;

      // Public unauthenticated GET request
      const response = await request(app).get(`/api/v1/urls/${shortCode}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'https://example.com/public-redirect-target'
      );
      expect(response.headers['cache-control']).toBe(
        'no-cache, no-store, must-revalidate'
      );
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

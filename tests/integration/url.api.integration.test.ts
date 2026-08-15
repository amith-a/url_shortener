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

  await pool.query('TRUNCATE TABLE urls RESTART IDENTITY CASCADE');
}

describe('API Integration Tests (Real PostgreSQL Test DB)', () => {
  beforeEach(async () => {
    await safeCleanupUrlTables();
  });

  describe('POST /api/v1/urls', () => {
    it('should create short URL and return 201 Created for valid URL', async () => {
      const response = await request(app)
        .post('/api/v1/urls')
        .send({ originalUrl: 'https://example.com/long-url-path' });

      expect(response.status).toBe(201);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('shortCode');
      expect(response.body).toHaveProperty(
        'originalUrl',
        'https://example.com/long-url-path'
      );
    });

    it('should return 400 Bad Request for malformed URL', async () => {
      const response = await request(app)
        .post('/api/v1/urls')
        .send({ originalUrl: 'not-a-valid-url' });

      expect(response.status).toBe(400);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body.errors).toHaveProperty('originalUrl');
    });

    it('should return 400 Bad Request for private/loopback SSRF hostnames', async () => {
      const privateUrls = [
        'http://localhost/admin',
        'http://127.0.0.1:8080/secret',
        'http://169.254.169.254/latest/meta-data/',
      ];

      for (const url of privateUrls) {
        const response = await request(app)
          .post('/api/v1/urls')
          .send({ originalUrl: url });

        expect(response.status).toBe(400);
        expect(response.headers['x-request-id']).toBeDefined();
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('should return 400 Bad Request when URL exceeds 2048 characters', async () => {
      const longUrl = `https://example.com/${'a'.repeat(2050)}`;

      const response = await request(app)
        .post('/api/v1/urls')
        .send({ originalUrl: longUrl });

      expect(response.status).toBe(400);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body).toHaveProperty('success', false);
    });

    it('should create short URL with valid customAlias and return 201 Created', async () => {
      const customAlias = 'myCustomAlias123';

      const response = await request(app)
        .post('/api/v1/urls')
        .send({
          originalUrl: 'https://example.com/alias-target',
          customAlias,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('shortCode', customAlias);
    });

    it('should return 409 Conflict when customAlias is already taken in the database', async () => {
      // First insertion
      await request(app)
        .post('/api/v1/urls')
        .send({
          originalUrl: 'https://example.com/first-target',
          customAlias: 'takenAlias123',
        });

      // Second insertion with identical alias
      const response = await request(app)
        .post('/api/v1/urls')
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

    it('should return 400 Bad Request for invalid customAlias formats', async () => {
      const invalidAliases = [
        'ab',
        'abc-123',
        'abc_123',
        'abc 123',
        'abc/123',
        'abc@123',
        'a'.repeat(51),
      ];

      for (const customAlias of invalidAliases) {
        const response = await request(app)
          .post('/api/v1/urls')
          .send({ originalUrl: 'https://example.com/target', customAlias });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Validation failed');
      }
    });

    it('should create short URL with valid future expiresAt containing timezone offset', async () => {
      const expiresAt = '2026-12-31T23:59:59+05:30';

      const response = await request(app)
        .post('/api/v1/urls')
        .send({ originalUrl: 'https://example.com/exp-target', expiresAt });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body.expiresAt).not.toBeNull();
    });

    it('should return 400 Bad Request when expiresAt lacks timezone offset or is in the past', async () => {
      const invalidTimestamps = [
        '2026-08-20T12:00:00', // Missing timezone offset/Z
        '2020-01-01T00:00:00Z', // Past date
        'invalid-date-string', // Malformed date
      ];

      for (const expiresAt of invalidTimestamps) {
        const response = await request(app)
          .post('/api/v1/urls')
          .send({ originalUrl: 'https://example.com/exp-target', expiresAt });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Validation failed');
        expect(response.body.errors).toHaveProperty('expiresAt');
      }
    });
  });

  describe('GET /api/v1/urls/:shortCode', () => {
    it('should redirect 302 to original URL with no-cache headers when short code exists', async () => {
      // Create short URL first
      const createRes = await request(app)
        .post('/api/v1/urls')
        .send({ originalUrl: 'https://example.com/redirect-target' });

      const shortCode = createRes.body.shortCode;

      const response = await request(app).get(`/api/v1/urls/${shortCode}`);

      expect(response.status).toBe(302);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers.location).toBe(
        'https://example.com/redirect-target'
      );
      expect(response.headers['cache-control']).toBe(
        'no-cache, no-store, must-revalidate'
      );
    });

    it('should return 410 Gone when short URL has expired', async () => {
      // Insert an expired row directly into the real test database
      const pastDate = new Date(Date.now() - 60000);
      await pool.query(
        `INSERT INTO urls (id, original_url, short_code, created_at, expires_at)
         VALUES ($1, $2, $3, NOW(), $4)`,
        ['11111111-1111-1111-1111-111111111111', 'https://example.com/expired-target', 'expired123', pastDate]
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
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body).toEqual({
        success: false,
        message: 'Short URL not found',
      });
    });

    it('should return 400 Bad Request for invalid short code format', async () => {
      const response = await request(app).get('/api/v1/urls/invalid_code!');

      expect(response.status).toBe(400);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Validation failed');
    });

    it('should redirect using a custom alias longer than 8 characters', async () => {
      const longAlias = 'a'.repeat(45);

      await request(app)
        .post('/api/v1/urls')
        .send({
          originalUrl: 'https://example.com/long-alias-target',
          customAlias: longAlias,
        });

      const response = await request(app).get(`/api/v1/urls/${longAlias}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'https://example.com/long-alias-target'
      );
    });
  });
});

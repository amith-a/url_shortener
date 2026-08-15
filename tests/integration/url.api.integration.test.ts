import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { QueryResult } from 'pg';
import app from '../../src/app';
import pool from '../../src/config/database';
import { UrlRow } from '../../src/repositories/types/url.row';

describe('API Integration Tests (Mocked DB)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/urls', () => {
    it('should create short URL and return 201 Created for valid URL', async () => {
      const mockRow: UrlRow = {
        id: 'uuid-123',
        short_code: 'abc12345',
        original_url: 'https://example.com/long-url-path',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        expires_at: null,
      };

      // Mock DB lookup (no collision) and DB insert
      vi.spyOn(pool, 'query')
        .mockImplementationOnce(
          async () => ({ rows: [] }) as unknown as QueryResult<UrlRow>
        )
        .mockImplementationOnce(
          async () => ({ rows: [mockRow] }) as unknown as QueryResult<UrlRow>
        );

      const response = await request(app)
        .post('/api/v1/urls')
        .send({ originalUrl: 'https://example.com/long-url-path' });

      expect(response.status).toBe(201);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body).toHaveProperty('id', 'uuid-123');
      expect(response.body).toHaveProperty('shortCode', 'abc12345');
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

    it('should return 500 Internal Server Error when database query fails unexpectedly', async () => {
      vi.spyOn(pool, 'query').mockImplementationOnce(async () => {
        throw new Error('Unexpected DB connection failure');
      });

      const response = await request(app)
        .post('/api/v1/urls')
        .send({ originalUrl: 'https://example.com/valid-url' });

      expect(response.status).toBe(500);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should create short URL with valid customAlias and return 201 Created', async () => {
      const validAliases = ['abc123', 'ABC123', '123456', 'a'.repeat(50)];

      for (const customAlias of validAliases) {
        const mockRow: UrlRow = {
          id: `uuid-${customAlias}`,
          short_code: customAlias,
          original_url: 'https://example.com/alias-target',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          expires_at: null,
        };

        vi.spyOn(pool, 'query').mockImplementationOnce(
          async () => ({ rows: [mockRow] }) as unknown as QueryResult<UrlRow>
        );

        const response = await request(app)
          .post('/api/v1/urls')
          .send({
            originalUrl: 'https://example.com/alias-target',
            customAlias,
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('shortCode', customAlias);
      }
    });

    it('should return 409 Conflict when customAlias is already taken', async () => {
      const pgUniqueError = new Error(
        'duplicate key value violates unique constraint'
      );
      (pgUniqueError as unknown as { code: string }).code = '23505';

      vi.spyOn(pool, 'query').mockImplementationOnce(async () => {
        throw pgUniqueError;
      });

      const response = await request(app)
        .post('/api/v1/urls')
        .send({
          originalUrl: 'https://example.com/alias-target',
          customAlias: 'takenAlias',
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
      const validFutureTimestamps = [
        '2026-08-20T12:00:00+05:30',
        '2026-08-20T06:30:00Z',
      ];

      for (const expiresAt of validFutureTimestamps) {
        const mockRow: UrlRow = {
          id: 'uuid-exp-1',
          short_code: 'exp12345',
          original_url: 'https://example.com/exp-target',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          expires_at: new Date(expiresAt),
        };

        vi.spyOn(pool, 'query')
          .mockImplementationOnce(
            async () => ({ rows: [] }) as unknown as QueryResult<UrlRow>
          )
          .mockImplementationOnce(
            async () => ({ rows: [mockRow] }) as unknown as QueryResult<UrlRow>
          );

        const response = await request(app)
          .post('/api/v1/urls')
          .send({ originalUrl: 'https://example.com/exp-target', expiresAt });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('expiresAt');
        expect(response.body.expiresAt).not.toBeNull();
      }
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
      const mockRow: UrlRow = {
        id: 'uuid-123',
        short_code: 'abc12345',
        original_url: 'https://example.com/redirect-target',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        expires_at: null,
      };

      vi.spyOn(pool, 'query').mockImplementationOnce(
        async () => ({ rows: [mockRow] }) as unknown as QueryResult<UrlRow>
      );

      const response = await request(app).get('/api/v1/urls/abc12345');

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
      const pastDate = new Date(Date.now() - 60000);
      const mockRow: UrlRow = {
        id: 'uuid-expired',
        short_code: 'expired1',
        original_url: 'https://example.com/expired-target',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        expires_at: pastDate,
      };

      vi.spyOn(pool, 'query').mockImplementationOnce(
        async () => ({ rows: [mockRow] }) as unknown as QueryResult<UrlRow>
      );

      const response = await request(app).get('/api/v1/urls/expired1');

      expect(response.status).toBe(410);
      expect(response.body).toEqual({
        success: false,
        message: 'URL has expired',
      });
    });

    it('should return 404 Not Found when short code does not exist', async () => {
      vi.spyOn(pool, 'query').mockImplementationOnce(
        async () => ({ rows: [] }) as unknown as QueryResult<UrlRow>
      );

      const response = await request(app).get('/api/v1/urls/noexist1');

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
      const customAlias = 'a'.repeat(50);

      const mockRow: UrlRow = {
        id: 'uuid-long-alias',
        short_code: customAlias,
        original_url: 'https://example.com/redirect-target',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        expires_at: null,
      };

      vi.spyOn(pool, 'query').mockImplementationOnce(
        async () => ({ rows: [mockRow] }) as unknown as QueryResult<UrlRow>
      );

      const response = await request(app).get(`/api/v1/urls/${customAlias}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'https://example.com/redirect-target'
      );
    });
  });
});

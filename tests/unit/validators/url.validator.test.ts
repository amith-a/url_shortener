import { describe, expect, it } from 'vitest';
import {
  getUrlSchema,
  listUrlsQuerySchema,
  urlIdParamSchema,
  urlSchema,
} from '../../../src/validators/url.validator.js';

describe('url.validator', () => {
  describe('urlSchema', () => {
    it('should validate valid http and https URLs', () => {
      const validUrls = [
        'http://example.com',
        'https://example.com/path/to/resource?query=123#hash',
        'https://subdomain.domain.org',
      ];

      for (const originalUrl of validUrls) {
        const result = urlSchema.safeParse({ originalUrl });
        expect(result.success).toBe(true);
      }
    });

    it('should reject non-HTTP protocols', () => {
      const invalidUrls = [
        'ftp://example.com',
        'javascript:alert(1)',
        'file:///etc/passwd',
      ];

      for (const originalUrl of invalidUrls) {
        const result = urlSchema.safeParse({ originalUrl });
        expect(result.success).toBe(false);
      }
    });

    it('should reject URLs exceeding 2048 characters', () => {
      const longPath = 'a'.repeat(2050);
      const originalUrl = `https://example.com/${longPath}`;

      const result = urlSchema.safeParse({ originalUrl });
      expect(result.success).toBe(false);
    });

    it('should reject private hostnames (SSRF protection)', () => {
      const privateUrls = [
        'http://localhost/admin',
        'http://127.0.0.1:8080/metrics',
        'http://0.0.0.0/',
        'http://169.254.169.254/latest/meta-data/',
        'http://10.0.0.1/internal',
        'http://192.168.1.1/router',
        'http://172.16.0.1/private',
      ];

      for (const originalUrl of privateUrls) {
        const result = urlSchema.safeParse({ originalUrl });
        expect(result.success).toBe(false);
      }
    });

    it('should validate valid custom alias formats and reject invalid ones', () => {
      const validRes = urlSchema.safeParse({
        originalUrl: 'https://example.com',
        customAlias: 'myAlias123',
      });
      expect(validRes.success).toBe(true);

      const invalidAliases = ['ab', 'a'.repeat(51), 'my-alias', 'my_alias', 'my alias'];
      for (const customAlias of invalidAliases) {
        const result = urlSchema.safeParse({
          originalUrl: 'https://example.com',
          customAlias,
        });
        expect(result.success).toBe(false);
      }
    });

    it('should validate ISO 8601 future expiration with timezone offset and reject invalid formats', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const validRes = urlSchema.safeParse({
        originalUrl: 'https://example.com',
        expiresAt: futureDate,
      });
      expect(validRes.success).toBe(true);

      const invalidExpirations = [
        'invalid-date',
        '2026-12-31T23:59:59', // missing timezone offset
        '2020-01-01T00:00:00+00:00', // past date
      ];
      for (const expiresAt of invalidExpirations) {
        const result = urlSchema.safeParse({
          originalUrl: 'https://example.com',
          expiresAt,
        });
        expect(result.success).toBe(false);
      }
    });
  });


  describe('getUrlSchema', () => {
    it('should validate valid short codes', () => {
      const validCodes = ['a', 'Abc12345', '12345678'];

      for (const shortCode of validCodes) {
        const result = getUrlSchema.safeParse({ shortCode });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid short codes', () => {
      const invalidCodes = [
        '',
        'a'.repeat(51), // > 50 chars
        'code_123', // contains underscore
        'code-123', // contains hyphen
        'code!',
      ];

      for (const shortCode of invalidCodes) {
        const result = getUrlSchema.safeParse({ shortCode });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('listUrlsQuerySchema', () => {
    it('should set default page=1 and limit=20 when query parameters are omitted', () => {
      const result = listUrlsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 1, limit: 20 });
      }
    });

    it('should parse valid page and limit numbers from strings', () => {
      const result = listUrlsQuerySchema.safeParse({ page: '2', limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 2, limit: 50 });
      }
    });

    it('should reject invalid page and limit values', () => {
      const invalidQueries = [
        { page: '0' },
        { page: '-1' },
        { limit: '0' },
        { limit: '101' },
        { page: 'abc' },
        { limit: 'xyz' },
      ];

      for (const query of invalidQueries) {
        const result = listUrlsQuerySchema.safeParse(query);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('urlIdParamSchema', () => {
    it('should validate valid UUID string', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = urlIdParamSchema.safeParse({ id: validUuid });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID string', () => {
      const invalidUuids = ['not-a-uuid', '123', ''];
      for (const id of invalidUuids) {
        const result = urlIdParamSchema.safeParse({ id });
        expect(result.success).toBe(false);
      }
    });
  });
});

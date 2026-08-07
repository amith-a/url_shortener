import { describe, expect, it } from 'vitest';
import { getUrlSchema, urlSchema } from '../../../src/validators/url.validator';

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
        '123456789', // > 8 chars
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
});

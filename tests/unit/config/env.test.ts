import { describe, it, expect } from 'vitest';
import { env } from '../../../src/config/env';
import { z } from 'zod';

// We import/create a test schema to validate CORS_ALLOWED_ORIGINS logic directly
const corsSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .transform((val) =>
        val
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      )
      .refine((origins) => origins.length > 0, {
        message: 'CORS_ALLOWED_ORIGINS must contain at least one origin',
      })
      .refine(
        (origins) =>
          origins.every((origin) => {
            if (origin === '*') return true;
            try {
              const parsed = new URL(origin);
              return (
                (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
                parsed.origin === origin
              );
            } catch {
              return false;
            }
          }),
        {
          message: 'All CORS origins must be valid HTTP/HTTPS origin URLs or "*"',
        }
      ),
  })
  .refine(
    (data) => {
      if (
        data.NODE_ENV === 'production' &&
        data.CORS_ALLOWED_ORIGINS.includes('*')
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Wildcard CORS origin (*) is not allowed in production',
      path: ['CORS_ALLOWED_ORIGINS'],
    }
  );

describe('Environment Configuration', () => {
  it('should export validated env object with expected defaults', () => {
    expect(env.PORT).toBeGreaterThan(0);
    expect(env.REQUEST_TIMEOUT_MS).toBe(10000);
    expect(env.SHUTDOWN_TIMEOUT_MS).toBe(10000);
    expect(Array.isArray(env.CORS_ALLOWED_ORIGINS)).toBe(true);
    expect(env.CORS_ALLOWED_ORIGINS.length).toBeGreaterThan(0);
  });

  describe('CORS_ALLOWED_ORIGINS validation', () => {
    it('should accept a valid HTTP origin', () => {
      const res = corsSchema.parse({
        NODE_ENV: 'development',
        CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      });
      expect(res.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000']);
    });

    it('should accept a valid HTTPS origin', () => {
      const res = corsSchema.parse({
        NODE_ENV: 'development',
        CORS_ALLOWED_ORIGINS: 'https://example.com',
      });
      expect(res.CORS_ALLOWED_ORIGINS).toEqual(['https://example.com']);
    });

    it('should accept multiple valid origins', () => {
      const res = corsSchema.parse({
        NODE_ENV: 'development',
        CORS_ALLOWED_ORIGINS: 'http://localhost:3000, https://app.example.com',
      });
      expect(res.CORS_ALLOWED_ORIGINS).toEqual([
        'http://localhost:3000',
        'https://app.example.com',
      ]);
    });

    it('should reject malformed origin', () => {
      expect(() =>
        corsSchema.parse({
          NODE_ENV: 'development',
          CORS_ALLOWED_ORIGINS: 'not-a-valid-url',
        })
      ).toThrow();
    });

    it('should reject origin with invalid protocol (e.g. ftp://)', () => {
      expect(() =>
        corsSchema.parse({
          NODE_ENV: 'development',
          CORS_ALLOWED_ORIGINS: 'ftp://example.com',
        })
      ).toThrow();
    });

    it('should reject wildcard origin (*) in production', () => {
      expect(() =>
        corsSchema.parse({
          NODE_ENV: 'production',
          CORS_ALLOWED_ORIGINS: '*',
        })
      ).toThrow('Wildcard CORS origin (*) is not allowed in production');
    });

    it('should reject empty origin list', () => {
      expect(() =>
        corsSchema.parse({
          NODE_ENV: 'development',
          CORS_ALLOWED_ORIGINS: '   ,  ',
        })
      ).toThrow();
    });
  });
});

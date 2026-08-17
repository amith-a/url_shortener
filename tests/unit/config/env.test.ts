import { describe, it, expect } from 'vitest';
import { env, envSchema } from '../../../src/config/env';

const validEnvFixture = {
  DATABASE_HOST: 'localhost',
  POSTGRES_DB: 'test_db',
  POSTGRES_USER: 'postgres',
  POSTGRES_PASSWORD: 'password',
  DATABASE_URL: 'postgres://postgres:password@localhost:5432/test_db',
  BETTER_AUTH_SECRET: '01234567890123456789012345678901',
};

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
      const res = envSchema.parse({
        ...validEnvFixture,
        NODE_ENV: 'development',
        CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      });
      expect(res.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000']);
    });

    it('should accept a valid HTTPS origin', () => {
      const res = envSchema.parse({
        ...validEnvFixture,
        NODE_ENV: 'development',
        CORS_ALLOWED_ORIGINS: 'https://example.com',
      });
      expect(res.CORS_ALLOWED_ORIGINS).toEqual(['https://example.com']);
    });

    it('should accept multiple valid origins', () => {
      const res = envSchema.parse({
        ...validEnvFixture,
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
        envSchema.parse({
          ...validEnvFixture,
          NODE_ENV: 'development',
          CORS_ALLOWED_ORIGINS: 'not-a-valid-url',
        })
      ).toThrow();
    });

    it('should reject origin with invalid protocol (e.g. ftp://)', () => {
      expect(() =>
        envSchema.parse({
          ...validEnvFixture,
          NODE_ENV: 'development',
          CORS_ALLOWED_ORIGINS: 'ftp://example.com',
        })
      ).toThrow();
    });

    it('should reject wildcard origin (*) in production', () => {
      expect(() =>
        envSchema.parse({
          ...validEnvFixture,
          NODE_ENV: 'production',
          CORS_ALLOWED_ORIGINS: '*',
        })
      ).toThrow('Wildcard CORS origin (*) is not allowed in production');
    });

    it('should reject empty origin list', () => {
      expect(() =>
        envSchema.parse({
          ...validEnvFixture,
          NODE_ENV: 'development',
          CORS_ALLOWED_ORIGINS: '   ,  ',
        })
      ).toThrow();
    });
  });

  describe('REQUEST_TIMEOUT_MS and SHUTDOWN_TIMEOUT_MS validation', () => {
    it('should accept valid custom positive numbers and numeric strings', () => {
      const res = envSchema.parse({
        ...validEnvFixture,
        REQUEST_TIMEOUT_MS: '5000',
        SHUTDOWN_TIMEOUT_MS: '15000',
      });
      expect(res.REQUEST_TIMEOUT_MS).toBe(5000);
      expect(res.SHUTDOWN_TIMEOUT_MS).toBe(15000);
    });

    it('should reject zero, negative, or non-numeric timeout values', () => {
      expect(() =>
        envSchema.parse({
          ...validEnvFixture,
          REQUEST_TIMEOUT_MS: 0,
        })
      ).toThrow();

      expect(() =>
        envSchema.parse({
          ...validEnvFixture,
          SHUTDOWN_TIMEOUT_MS: -100,
        })
      ).toThrow();

      expect(() =>
        envSchema.parse({
          ...validEnvFixture,
          REQUEST_TIMEOUT_MS: 'invalid-number',
        })
      ).toThrow();
    });
  });
});


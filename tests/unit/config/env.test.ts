import { describe, it, expect } from 'vitest';
import { env } from '../../../src/config/env';

describe('Environment Configuration', () => {
  it('should export validated env object with expected defaults', () => {
    expect(env.PORT).toBeGreaterThan(0);
    expect(env.REQUEST_TIMEOUT_MS).toBe(10000);
    expect(env.SHUTDOWN_TIMEOUT_MS).toBe(10000);
    expect(Array.isArray(env.CORS_ALLOWED_ORIGINS)).toBe(true);
    expect(env.CORS_ALLOWED_ORIGINS.length).toBeGreaterThan(0);
  });
});

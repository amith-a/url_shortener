import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { RateLimitService } from '../../../src/services/rate-limit.service';

describe('RateLimitService', () => {
  let mockRedis: { eval: ReturnType<typeof vi.fn> };
  let service: RateLimitService;

  beforeEach(() => {
    mockRedis = {
      eval: vi.fn(),
    };
    service = new RateLimitService(mockRedis as unknown as Redis);
  });

  describe('buildKey', () => {
    it('should build formatted rate limit key', () => {
      const key = service.buildKey('test-scope', 'user123');
      expect(key).toBe('ratelimit:test-scope:user123');
    });
  });

  describe('check', () => {
    it('should allow first request within limit and set remaining quota', async () => {
      mockRedis.eval.mockResolvedValue([1, 60]);

      const result = await service.check('ratelimit:test:user1', 5, 60);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'ratelimit:test:user1',
        60
      );
      expect(result).toEqual({
        allowed: true,
        limit: 5,
        remaining: 4,
        resetSeconds: 60,
      });
    });

    it('should allow subsequent request within limit and calculate remaining quota', async () => {
      mockRedis.eval.mockResolvedValue([3, 45]);

      const result = await service.check('ratelimit:test:user1', 5, 60);

      expect(result).toEqual({
        allowed: true,
        limit: 5,
        remaining: 2,
        resetSeconds: 45,
      });
    });

    it('should reject request exceeding the limit', async () => {
      mockRedis.eval.mockResolvedValue([6, 30]);

      const result = await service.check('ratelimit:test:user1', 5, 60);

      expect(result).toEqual({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetSeconds: 30,
      });
    });

    it('should handle window expiration reset', async () => {
      mockRedis.eval.mockResolvedValue([1, 60]);

      const result = await service.check('ratelimit:test:user1', 5, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetSeconds).toBe(60);
    });

    it('should calculate resetSeconds from windowSeconds if TTL is 0 or negative', async () => {
      mockRedis.eval.mockResolvedValue([1, -1]);

      const result = await service.check('ratelimit:test:user1', 5, 60);

      expect(result.resetSeconds).toBe(60);
    });

    it('should fail open when Redis command throws error', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis connection lost'));

      const result = await service.check('ratelimit:test:user1', 5, 60);

      expect(result).toEqual({
        allowed: true,
        limit: 5,
        remaining: 5,
        resetSeconds: 60,
      });
    });
  });
});

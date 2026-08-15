import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UrlCacheService } from '../../../src/services/url-cache.service';
import type { Redis } from 'ioredis';

describe('UrlCacheService', () => {
  let mockRedis: Redis;
  let cacheService: UrlCacheService;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    } as unknown as Redis;

    cacheService = new UrlCacheService(mockRedis);
  });

  describe('get', () => {
    it('should return cached URL when key exists in Redis (Cache HIT)', async () => {
      vi.mocked(mockRedis.get).mockResolvedValueOnce('https://example.com');

      const result = await cacheService.get('abc12345');

      expect(mockRedis.get).toHaveBeenCalledWith('url:abc12345');
      expect(result).toBe('https://example.com');
    });

    it('should return null when key does not exist in Redis (Cache MISS)', async () => {
      vi.mocked(mockRedis.get).mockResolvedValueOnce(null);

      const result = await cacheService.get('nonexistent');

      expect(mockRedis.get).toHaveBeenCalledWith('url:nonexistent');
      expect(result).toBeNull();
    });

    it('should handle Redis GET failure safely and return null', async () => {
      vi.mocked(mockRedis.get).mockRejectedValueOnce(new Error('Redis connection error'));

      const result = await cacheService.get('abc12345');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set key in Redis with EX ttl when ttlSeconds > 0', async () => {
      vi.mocked(mockRedis.set).mockResolvedValueOnce('OK');

      await cacheService.set('abc12345', 'https://example.com', 3600);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'url:abc12345',
        'https://example.com',
        'EX',
        3600
      );
    });

    it('should not call Redis set when ttlSeconds <= 0', async () => {
      await cacheService.set('abc12345', 'https://example.com', 0);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis SET failure safely without throwing', async () => {
      vi.mocked(mockRedis.set).mockRejectedValueOnce(new Error('Redis SET error'));

      await expect(
        cacheService.set('abc12345', 'https://example.com', 3600)
      ).resolves.not.toThrow();
    });
  });

  describe('delete', () => {
    it('should call Redis del with formatted key', async () => {
      vi.mocked(mockRedis.del).mockResolvedValueOnce(1);

      await cacheService.delete('abc12345');

      expect(mockRedis.del).toHaveBeenCalledWith('url:abc12345');
    });

    it('should handle Redis DEL failure safely without throwing', async () => {
      vi.mocked(mockRedis.del).mockRejectedValueOnce(new Error('Redis DEL error'));

      await expect(cacheService.delete('abc12345')).resolves.not.toThrow();
    });
  });

  describe('flushTestKeys', () => {
    it('should delete keys matching url:* if present', async () => {
      vi.mocked(mockRedis.keys).mockResolvedValueOnce(['url:1', 'url:2']);
      vi.mocked(mockRedis.del).mockResolvedValueOnce(2);

      await cacheService.flushTestKeys();

      expect(mockRedis.keys).toHaveBeenCalledWith('url:*');
      expect(mockRedis.del).toHaveBeenCalledWith('url:1', 'url:2');
    });

    it('should do nothing if no matching keys exist', async () => {
      vi.mocked(mockRedis.keys).mockResolvedValueOnce([]);

      await cacheService.flushTestKeys();

      expect(mockRedis.keys).toHaveBeenCalledWith('url:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});

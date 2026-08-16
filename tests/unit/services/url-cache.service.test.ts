import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    it('should return parsed CachedUrlPayload when key exists in Redis as JSON (Cache HIT)', async () => {
      const payload = {
        urlId: 'url-uuid-1',
        originalUrl: 'https://example.com',
      };
      vi.mocked(mockRedis.get).mockResolvedValueOnce(JSON.stringify(payload));

      const result = await cacheService.get('abc12345');

      expect(mockRedis.get).toHaveBeenCalledWith('url:abc12345');
      expect(result).toEqual(payload);
    });

    it('should return null when legacy raw string is stored in Redis', async () => {
      vi.mocked(mockRedis.get).mockResolvedValueOnce('https://example.com');

      const result = await cacheService.get('abc12345');

      expect(mockRedis.get).toHaveBeenCalledWith('url:abc12345');
      expect(result).toBeNull();
    });

    it('should return null when key does not exist in Redis (Cache MISS)', async () => {
      vi.mocked(mockRedis.get).mockResolvedValueOnce(null);

      const result = await cacheService.get('nonexistent');

      expect(mockRedis.get).toHaveBeenCalledWith('url:nonexistent');
      expect(result).toBeNull();
    });

    it('should handle Redis GET failure safely and return null', async () => {
      vi.mocked(mockRedis.get).mockRejectedValueOnce(
        new Error('Redis connection error')
      );

      const result = await cacheService.get('abc12345');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set JSON payload in Redis with EX ttl when ttlSeconds > 0', async () => {
      vi.mocked(mockRedis.set).mockResolvedValueOnce('OK');

      const payload = {
        urlId: 'url-uuid-1',
        originalUrl: 'https://example.com',
      };
      await cacheService.set('abc12345', payload, 3600);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'url:abc12345',
        JSON.stringify(payload),
        'EX',
        3600
      );
    });

    it('should not call Redis set when ttlSeconds <= 0', async () => {
      const payload = {
        urlId: 'url-uuid-1',
        originalUrl: 'https://example.com',
      };
      await cacheService.set('abc12345', payload, 0);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis SET failure safely without throwing', async () => {
      vi.mocked(mockRedis.set).mockRejectedValueOnce(
        new Error('Redis SET error')
      );

      const payload = {
        urlId: 'url-uuid-1',
        originalUrl: 'https://example.com',
      };
      await expect(
        cacheService.set('abc12345', payload, 3600)
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
      vi.mocked(mockRedis.del).mockRejectedValueOnce(
        new Error('Redis DEL error')
      );

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

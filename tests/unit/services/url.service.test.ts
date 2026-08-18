import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UrlService } from '../../../src/services/url.service.js';
import type { IUrlRepository } from '../../../src/repositories/interfaces/url.repository.interface.js';
import type { UrlCacheService } from '../../../src/services/url-cache.service.js';
import type { UrlAnalyticsService } from '../../../src/services/url-analytics.service.js';

describe('UrlService', () => {
  let repository: IUrlRepository;
  let cacheService: UrlCacheService;
  let analyticsService: UrlAnalyticsService;
  let service: UrlService;

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findByShortCode: vi.fn(),
      deleteByIdAndUserId: vi.fn(),
      findByIdAndUserId: vi.fn(),
      listByUserId: vi.fn(),
      countByUserId: vi.fn(),
      deleteExpiredUrls: vi.fn(),
    };

    cacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      flushTestKeys: vi.fn(),
    } as unknown as UrlCacheService;

    analyticsService = {
      recordClick: vi.fn(),
      getAnalytics: vi.fn(),
    } as unknown as UrlAnalyticsService;

    service = new UrlService(repository, cacheService, analyticsService);
  });

  describe('create', () => {
    it('should create and return a short URL DTO on first attempt', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce(null);
      vi.mocked(repository.create).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'abc12345',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: null,
      });

      const result = await service.create(
        { originalUrl: 'https://example.com' },
        'user-123'
      );

      expect(repository.findByShortCode).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
        })
      );
      expect(result.originalUrl).toBe('https://example.com');
    });

    it('should retry when short code exists on initial lookup', async () => {
      const existingDto = {
        id: 'uuid-0',
        shortCode: 'existing',
        originalUrl: 'https://existing.com',
        createdAt: new Date(),
        expiresAt: null,
      };

      vi.mocked(repository.findByShortCode)
        .mockResolvedValueOnce(existingDto)
        .mockResolvedValueOnce(null);

      vi.mocked(repository.create).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'newcode1',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: null,
      });

      const result = await service.create(
        { originalUrl: 'https://example.com' },
        'user-123'
      );

      expect(repository.findByShortCode).toHaveBeenCalledTimes(2);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(result.shortCode).toBe('newcode1');
    });

    it('should retry when repository throws unique constraint violation (23505)', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValue(null);

      const pgUniqueError = new Error('Unique constraint error');
      (pgUniqueError as unknown as { code: string }).code = '23505';

      vi.mocked(repository.create)
        .mockRejectedValueOnce(pgUniqueError)
        .mockResolvedValueOnce({
          id: 'uuid-2',
          shortCode: 'retry123',
          originalUrl: 'https://example.com',
          createdAt: new Date(),
          expiresAt: null,
        });

      const result = await service.create(
        { originalUrl: 'https://example.com' },
        'user-123'
      );

      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(result.shortCode).toBe('retry123');
    });

    it('should throw AppError after max attempts (5) are exceeded', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValue(null);

      const pgUniqueError = new Error('Unique constraint error');
      (pgUniqueError as unknown as { code: string }).code = '23505';

      vi.mocked(repository.create).mockRejectedValue(pgUniqueError);

      await expect(
        service.create({ originalUrl: 'https://example.com' }, 'user-123')
      ).rejects.toThrow(
        'Failed to create short URL due to repeated collisions'
      );

      expect(repository.create).toHaveBeenCalledTimes(5);
    });

    it('should create URL with custom alias without performing preliminary lookup', async () => {
      vi.mocked(repository.create).mockResolvedValueOnce({
        id: 'uuid-custom-1',
        shortCode: 'myCustomAlias',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: null,
      });

      const result = await service.create(
        {
          originalUrl: 'https://example.com',
          customAlias: 'myCustomAlias',
        },
        'user-123'
      );

      expect(repository.findByShortCode).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(result.shortCode).toBe('myCustomAlias');
    });

    it('should throw ConflictError when customAlias produces 23505 unique violation without retry', async () => {
      const pgUniqueError = new Error('Unique constraint error');
      (pgUniqueError as unknown as { code: string }).code = '23505';

      vi.mocked(repository.create).mockRejectedValueOnce(pgUniqueError);

      await expect(
        service.create(
          {
            originalUrl: 'https://example.com',
            customAlias: 'duplicateAlias',
          },
          'user-123'
        )
      ).rejects.toThrow('Custom alias is already in use');

      expect(repository.findByShortCode).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteUrl', () => {
    it('should delete URL and invalidate Redis cache when id and userId match', async () => {
      vi.mocked(repository.deleteByIdAndUserId).mockResolvedValueOnce(
        'url-123-code'
      );
      vi.mocked(cacheService.delete).mockResolvedValueOnce(undefined);

      await expect(
        service.deleteUrl('url-123', 'user-123')
      ).resolves.toBeUndefined();

      expect(repository.deleteByIdAndUserId).toHaveBeenCalledWith(
        'url-123',
        'user-123'
      );
      expect(cacheService.delete).toHaveBeenCalledWith('url-123-code');
    });

    it('should throw NotFoundError when deletion fails (no matching row)', async () => {
      vi.mocked(repository.deleteByIdAndUserId).mockResolvedValueOnce(null);

      await expect(
        service.deleteUrl('url-123', 'other-user')
      ).rejects.toThrow('Short URL not found');

      expect(cacheService.delete).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should call listByUserId and countByUserId and combine results into paginated response', async () => {
      const mockDtos = [
        {
          id: 'url-1',
          shortCode: 'code1',
          originalUrl: 'https://example.com/1',
          createdAt: new Date(),
          expiresAt: null,
        },
        {
          id: 'url-2',
          shortCode: 'code2',
          originalUrl: 'https://example.com/2',
          createdAt: new Date(),
          expiresAt: null,
        },
      ];

      vi.mocked(repository.listByUserId).mockResolvedValueOnce(mockDtos);
      vi.mocked(repository.countByUserId).mockResolvedValueOnce(45);

      const result = await service.list('user-123', 2, 20);

      expect(repository.listByUserId).toHaveBeenCalledWith('user-123', 20, 20);
      expect(repository.countByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        data: mockDtos,
        pagination: {
          page: 2,
          limit: 20,
          total: 45,
          totalPages: 3,
        },
      });
    });

    it('should handle empty user results correctly with totalPages 0', async () => {
      vi.mocked(repository.listByUserId).mockResolvedValueOnce([]);
      vi.mocked(repository.countByUserId).mockResolvedValueOnce(0);

      const result = await service.list('user-empty', 1, 20);

      expect(result).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });
    });
  });

  describe('resolveShortCode', () => {
    it('should return cached original URL and record click on Cache HIT without querying PostgreSQL', async () => {
      vi.mocked(cacheService.get).mockResolvedValueOnce({
        urlId: 'uuid-cached-1',
        originalUrl: 'https://cached.com',
      });
      vi.mocked(analyticsService.recordClick).mockResolvedValueOnce(undefined);

      const url = await service.resolveShortCode('cachedCode');

      expect(cacheService.get).toHaveBeenCalledWith('cachedCode');
      expect(repository.findByShortCode).not.toHaveBeenCalled();
      expect(analyticsService.recordClick).toHaveBeenCalledWith(
        'uuid-cached-1'
      );
      expect(url).toBe('https://cached.com');
    });

    it('should query PostgreSQL on Cache MISS, record click, populate cache with payload, and return original URL', async () => {
      vi.mocked(cacheService.get).mockResolvedValueOnce(null);
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'abc12345',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: null,
      });
      vi.mocked(analyticsService.recordClick).mockResolvedValueOnce(undefined);
      vi.mocked(cacheService.set).mockResolvedValueOnce(undefined);

      const url = await service.resolveShortCode('abc12345');

      expect(cacheService.get).toHaveBeenCalledWith('abc12345');
      expect(repository.findByShortCode).toHaveBeenCalledWith('abc12345');
      expect(analyticsService.recordClick).toHaveBeenCalledWith('uuid-1');
      expect(cacheService.set).toHaveBeenCalledWith(
        'abc12345',
        { urlId: 'uuid-1', originalUrl: 'https://example.com' },
        expect.any(Number)
      );
      expect(url).toBe('https://example.com');
    });

    it('should compute effective TTL capped by remaining expiration time for expiring URLs', async () => {
      vi.mocked(cacheService.get).mockResolvedValueOnce(null);
      const futureDate = new Date(Date.now() + 60000); // 60 seconds from now
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'future12',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: futureDate,
      });
      vi.mocked(analyticsService.recordClick).mockResolvedValueOnce(undefined);
      vi.mocked(cacheService.set).mockResolvedValueOnce(undefined);

      const url = await service.resolveShortCode('future12');

      expect(url).toBe('https://example.com');
      expect(analyticsService.recordClick).toHaveBeenCalledWith('uuid-1');
      expect(cacheService.set).toHaveBeenCalledWith(
        'future12',
        { urlId: 'uuid-1', originalUrl: 'https://example.com' },
        expect.any(Number)
      );
    });

    it('should delete cache key and throw GoneError without recording click when URL is expired in PostgreSQL', async () => {
      vi.mocked(cacheService.get).mockResolvedValueOnce(null);
      const pastDate = new Date(Date.now() - 1000);
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'expired1',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: pastDate,
      });
      vi.mocked(cacheService.delete).mockResolvedValueOnce(undefined);

      await expect(service.resolveShortCode('expired1')).rejects.toThrow(
        'URL has expired'
      );
      expect(cacheService.delete).toHaveBeenCalledWith('expired1');
      expect(analyticsService.recordClick).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError without recording click when short code does not exist in PostgreSQL', async () => {
      vi.mocked(cacheService.get).mockResolvedValueOnce(null);
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce(null);

      await expect(service.resolveShortCode('nonexistent')).rejects.toThrow(
        'Short URL not found'
      );
      expect(analyticsService.recordClick).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should fail open and return URL when analyticsService.recordClick fails', async () => {
      vi.mocked(cacheService.get).mockResolvedValueOnce(null);
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'abc12345',
        originalUrl: 'https://fallback.com',
        createdAt: new Date(),
        expiresAt: null,
      });
      vi.mocked(analyticsService.recordClick).mockRejectedValueOnce(
        new Error('DB click failure')
      );

      const url = await service.resolveShortCode('abc12345');

      expect(url).toBe('https://fallback.com');
    });
  });
});

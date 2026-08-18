import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UrlCleanupService } from '../../../src/services/url-cleanup.service.js';
import type { IUrlRepository } from '../../../src/repositories/interfaces/url.repository.interface.js';
import type { UrlCacheService } from '../../../src/services/url-cache.service.js';

describe('UrlCleanupService', () => {
  let service: UrlCleanupService;
  let mockRepository: IUrlRepository;
  let mockCacheService: UrlCacheService;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn(),
      findByShortCode: vi.fn(),
      deleteByIdAndUserId: vi.fn(),
      findByIdAndUserId: vi.fn(),
      listByUserId: vi.fn(),
      countByUserId: vi.fn(),
      deleteExpiredUrls: vi.fn(),
    };

    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      flushTestKeys: vi.fn(),
    } as unknown as UrlCacheService;

    service = new UrlCleanupService(mockRepository, mockCacheService);
  });

  it('should call repository deleteExpiredUrls and delete cache entries for expired short codes', async () => {
    vi.mocked(mockRepository.deleteExpiredUrls).mockResolvedValueOnce([
      'code1',
      'code2',
    ]);
    vi.mocked(mockCacheService.delete).mockResolvedValue(undefined);

    const count = await service.cleanupExpiredUrls();

    expect(mockRepository.deleteExpiredUrls).toHaveBeenCalledTimes(1);
    expect(mockCacheService.delete).toHaveBeenCalledTimes(2);
    expect(mockCacheService.delete).toHaveBeenNthCalledWith(1, 'code1');
    expect(mockCacheService.delete).toHaveBeenNthCalledWith(2, 'code2');
    expect(count).toBe(2);
  });

  it('should return 0 and perform no cache deletes when no URLs are expired', async () => {
    vi.mocked(mockRepository.deleteExpiredUrls).mockResolvedValueOnce([]);

    const count = await service.cleanupExpiredUrls();

    expect(mockRepository.deleteExpiredUrls).toHaveBeenCalledTimes(1);
    expect(mockCacheService.delete).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });

  it('should return the deleted URL count and invalidate cache entries', async () => {
    vi.mocked(mockRepository.deleteExpiredUrls).mockResolvedValueOnce([
      'code1',
    ]);

    vi.mocked(mockCacheService.delete).mockResolvedValueOnce(undefined);

    const count = await service.cleanupExpiredUrls();

    expect(count).toBe(1);
    expect(mockCacheService.delete).toHaveBeenCalledWith('code1');
  });

  it('should throw error when repository deleteExpiredUrls fails', async () => {
    vi.mocked(mockRepository.deleteExpiredUrls).mockRejectedValueOnce(
      new Error('DB failure')
    );

    await expect(service.cleanupExpiredUrls()).rejects.toThrow('DB failure');
    expect(mockCacheService.delete).not.toHaveBeenCalled();
  });
});

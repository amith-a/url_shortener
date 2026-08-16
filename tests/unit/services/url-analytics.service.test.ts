import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UrlAnalyticsService } from '../../../src/services/url-analytics.service';
import { IUrlAnalyticsRepository } from '../../../src/repositories/interfaces/url-analytics.repository.interface';
import { IUrlRepository } from '../../../src/repositories/interfaces/url.repository.interface';
import { UrlDto } from '../../../src/dto/url.dto';

describe('UrlAnalyticsService Unit Tests', () => {
  const mockAnalyticsRepo: IUrlAnalyticsRepository = {
    recordClick: vi.fn(),
    countClicks: vi.fn(),
  };

  const mockUrlRepo: IUrlRepository = {
    create: vi.fn(),
    findByShortCode: vi.fn(),
    deleteByIdAndUserId: vi.fn(),
    findByIdAndUserId: vi.fn(),
    listByUserId: vi.fn(),
    countByUserId: vi.fn(),
  };

  const analyticsService = new UrlAnalyticsService(
    mockAnalyticsRepo,
    mockUrlRepo
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate recordClick to analytics repository', async () => {
    vi.mocked(mockAnalyticsRepo.recordClick).mockResolvedValue(undefined);

    await analyticsService.recordClick('url-uuid-1');

    expect(mockAnalyticsRepo.recordClick).toHaveBeenCalledWith('url-uuid-1');
  });

  it('should return analytics DTO when requested by URL owner', async () => {
    const mockUrl: UrlDto = {
      id: 'url-uuid-1',
      shortCode: 'abc12345',
      originalUrl: 'https://example.com',
      createdAt: new Date(),
      expiresAt: null,
      userId: 'user-1',
    };

    vi.mocked(mockUrlRepo.findByIdAndUserId).mockResolvedValue(mockUrl);
    vi.mocked(mockAnalyticsRepo.countClicks).mockResolvedValue(42);

    const result = await analyticsService.getAnalytics('url-uuid-1', 'user-1');

    expect(mockUrlRepo.findByIdAndUserId).toHaveBeenCalledWith(
      'url-uuid-1',
      'user-1'
    );
    expect(mockAnalyticsRepo.countClicks).toHaveBeenCalledWith('url-uuid-1');
    expect(result).toEqual({
      urlId: 'url-uuid-1',
      totalClicks: 42,
    });
  });

  it('should throw NotFoundError when URL is not owned by user', async () => {
    vi.mocked(mockUrlRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      analyticsService.getAnalytics('url-uuid-1', 'user-2')
    ).rejects.toThrow('Short URL not found');

    expect(mockAnalyticsRepo.countClicks).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when URL does not exist', async () => {
    vi.mocked(mockUrlRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      analyticsService.getAnalytics('nonexistent-url-id', 'user-1')
    ).rejects.toThrow('Short URL not found');

    expect(mockAnalyticsRepo.countClicks).not.toHaveBeenCalled();
  });
});

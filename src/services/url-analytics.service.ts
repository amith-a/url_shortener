import type { IUrlAnalyticsRepository } from '../repositories/interfaces/url-analytics.repository.interface';
import type { IUrlRepository } from '../repositories/interfaces/url.repository.interface';
import { UrlAnalyticsDto } from '../dto/url-analytics.dto';
import { NotFoundError } from '../errors/not-found.error';

export class UrlAnalyticsService {
  constructor(
    private readonly analyticsRepository: IUrlAnalyticsRepository,
    private readonly urlRepository: IUrlRepository
  ) {}

  async recordClick(urlId: string): Promise<void> {
    await this.analyticsRepository.recordClick(urlId);
  }

  async getAnalytics(urlId: string, userId: string): Promise<UrlAnalyticsDto> {
    const url = await this.urlRepository.findByIdAndUserId(urlId, userId);

    if (!url) {
      throw new NotFoundError('Short URL not found');
    }

    const totalClicks = await this.analyticsRepository.countClicks(urlId);

    return {
      urlId,
      totalClicks,
    };
  }
}

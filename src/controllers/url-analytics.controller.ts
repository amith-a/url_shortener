import { Request, Response } from 'express';
import { UrlAnalyticsService } from '../services/url-analytics.service';

export class UrlAnalyticsController {
  constructor(private readonly analyticsService: UrlAnalyticsService) {}

  async getAnalytics(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    const urlId = req.params.id;
    const userId = req.user!.id;

    const result = await this.analyticsService.getAnalytics(urlId, userId);

    res.status(200).json(result);
  }
}

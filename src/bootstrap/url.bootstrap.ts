import { UrlController } from '../controllers/url.controller';
import { UrlAnalyticsController } from '../controllers/url-analytics.controller';
import { UrlRepository } from '../repositories/url.repository';
import { UrlAnalyticsRepository } from '../repositories/url-analytics.repository';
import { UrlService } from '../services/url.service';
import { UrlAnalyticsService } from '../services/url-analytics.service';
import { UrlCacheService } from '../services/url-cache.service';
import { RateLimitService } from '../services/rate-limit.service';
import { redis } from '../config/redis';

const repository = new UrlRepository();
const analyticsRepository = new UrlAnalyticsRepository();
const cacheService = new UrlCacheService(redis);
const rateLimitService = new RateLimitService(redis);
const analyticsService = new UrlAnalyticsService(
  analyticsRepository,
  repository
);
const service = new UrlService(repository, cacheService, analyticsService);
const controller = new UrlController(service);
const analyticsController = new UrlAnalyticsController(analyticsService);

export { controller, analyticsController, cacheService, rateLimitService };

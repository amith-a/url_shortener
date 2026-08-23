import { UrlController } from '../controllers/url.controller.js';
import { UrlAnalyticsController } from '../controllers/url-analytics.controller.js';
import { UrlRepository } from '../repositories/url.repository.js';
import { UrlAnalyticsRepository } from '../repositories/url-analytics.repository.js';
import {
  MongoUrlRepository,
  MongoUrlAnalyticsRepository,
} from '../repositories/mongo/index.js';
import { UrlService } from '../services/url.service.js';
import { UrlAnalyticsService } from '../services/url-analytics.service.js';
import { UrlCacheService } from '../services/url-cache.service.js';
import { UrlCleanupService } from '../services/url-cleanup.service.js';
import { RateLimitService } from '../services/rate-limit.service.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { IUrlRepository } from '../repositories/interfaces/url.repository.interface.js';
import { IUrlAnalyticsRepository } from '../repositories/interfaces/url-analytics.repository.interface.js';

let repository: IUrlRepository;
let analyticsRepository: IUrlAnalyticsRepository;

if (env.DB_PROVIDER === 'mongodb') {
  repository = new MongoUrlRepository();
  analyticsRepository = new MongoUrlAnalyticsRepository();
} else {
  repository = new UrlRepository();
  analyticsRepository = new UrlAnalyticsRepository();
}

const cacheService = new UrlCacheService(redis);
const rateLimitService = new RateLimitService(redis);
const analyticsService = new UrlAnalyticsService(
  analyticsRepository,
  repository
);
const cleanupService = new UrlCleanupService(repository, cacheService);
const service = new UrlService(repository, cacheService, analyticsService);
const controller = new UrlController(service);
const analyticsController = new UrlAnalyticsController(analyticsService);

export {
  controller,
  analyticsController,
  cacheService,
  rateLimitService,
  cleanupService,
  repository,
  analyticsRepository,
};

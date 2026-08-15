import { UrlController } from '../controllers/url.controller';
import { UrlRepository } from '../repositories/url.repository';
import { UrlService } from '../services/url.service';
import { UrlCacheService } from '../services/url-cache.service';
import { redis } from '../config/redis';

const repository = new UrlRepository();
const cacheService = new UrlCacheService(redis);
const service = new UrlService(repository, cacheService);
const controller = new UrlController(service);

export { controller, cacheService };

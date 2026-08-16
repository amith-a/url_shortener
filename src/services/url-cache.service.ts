import type { Redis } from 'ioredis';
import { logger } from '../config/logger';

export class UrlCacheService {
  constructor(private readonly client: Redis) {}

  private buildKey(shortCode: string): string {
    return `url:${shortCode}`;
  }

  async get(shortCode: string): Promise<string | null> {
    const key = this.buildKey(shortCode);
    try {
      const cachedUrl = await this.client.get(key);
      if (cachedUrl) {
        logger.debug({ shortCode, key }, 'Redis cache hit for short code');
        return cachedUrl;
      }
      logger.debug({ shortCode, key }, 'Redis cache miss for short code');
      return null;
    } catch (err) {
      logger.error(
        { err, shortCode, key },
        'Redis cache get error, falling back to PostgreSQL'
      );
      return null;
    }
  }

  async set(
    shortCode: string,
    originalUrl: string,
    ttlSeconds: number
  ): Promise<void> {
    if (ttlSeconds <= 0) {
      return;
    }

    const key = this.buildKey(shortCode);
    try {
      await this.client.set(key, originalUrl, 'EX', ttlSeconds);
      logger.debug(
        { shortCode, key, ttlSeconds },
        'Cached original URL in Redis successfully'
      );
    } catch (err) {
      logger.error(
        { err, shortCode, key, ttlSeconds },
        'Redis cache set error, continuing without cache update'
      );
    }
  }

  async delete(shortCode: string): Promise<void> {
    const key = this.buildKey(shortCode);
    try {
      await this.client.del(key);
      logger.debug(
        { shortCode, key },
        'Invalidated Redis cache key successfully'
      );
    } catch (err) {
      logger.error(
        { err, shortCode, key },
        'Redis cache delete error, continuing without cache deletion'
      );
    }
  }

  async flushTestKeys(): Promise<void> {
    try {
      const keys = await this.client.keys('url:*');
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to flush test keys from Redis');
    }
  }
}

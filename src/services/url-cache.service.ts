import type { Redis } from 'ioredis';
import { logger } from '../config/logger';

export interface CachedUrlPayload {
  urlId: string;
  originalUrl: string;
}

export class UrlCacheService {
  constructor(private readonly client: Redis) {}

  private buildKey(shortCode: string): string {
    return `url:${shortCode}`;
  }

  async get(shortCode: string): Promise<CachedUrlPayload | null> {
    const key = this.buildKey(shortCode);
    try {
      const cachedValue = await this.client.get(key);
      if (cachedValue) {
        logger.debug({ shortCode, key }, 'Redis cache hit for short code');
        try {
          const parsed = JSON.parse(cachedValue) as CachedUrlPayload;
          if (
            parsed &&
            typeof parsed === 'object' &&
            parsed.urlId &&
            parsed.originalUrl
          ) {
            return parsed;
          }
        } catch {
          logger.warn(
            { shortCode, key },
            'Legacy raw string found in cache, treating as cache miss'
          );
          return null;
        }
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
    payload: CachedUrlPayload,
    ttlSeconds: number
  ): Promise<void> {
    if (ttlSeconds <= 0) {
      return;
    }

    const key = this.buildKey(shortCode);
    try {
      await this.client.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
      logger.debug(
        { shortCode, key, ttlSeconds },
        'Cached URL payload in Redis successfully'
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
      let cursor = '0';
      const keysToDelete: string[] = [];

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          'url:*',
          'COUNT',
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          keysToDelete.push(...keys);
        }
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await this.client.del(...keysToDelete);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to flush test keys from Redis');
    }
  }
}

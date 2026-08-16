import type { Redis } from 'ioredis';
import { logger } from '../config/logger';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

const LUA_RATE_LIMIT_SCRIPT = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  local ttl = redis.call('TTL', KEYS[1])
  return { current, ttl }
`;

export class RateLimitService {
  constructor(private readonly redisClient: Redis) {}

  public buildKey(scope: string, identity: string): string {
    return `ratelimit:${scope}:${identity}`;
  }

  async check(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    try {
      const result = (await this.redisClient.eval(
        LUA_RATE_LIMIT_SCRIPT,
        1,
        key,
        windowSeconds
      )) as [number, number];

      const count = Number(result[0]);
      const ttl = Number(result[1]);

      const resetSeconds = ttl > 0 ? ttl : windowSeconds;
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);

      return {
        allowed,
        limit,
        remaining,
        resetSeconds,
      };
    } catch (err) {
      logger.error(
        { err, key },
        'Redis rate limiter error, failing open to allow request'
      );
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetSeconds: windowSeconds,
      };
    }
  }
}

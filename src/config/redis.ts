import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info({ redisUrl: env.REDIS_URL }, 'Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (err: Error) => {
  logger.error({ err }, 'Redis client connection error');
});

const parsedRedisUrl = new URL(env.REDIS_URL);
const dbIndex = parsedRedisUrl.pathname
  ? parseInt(parsedRedisUrl.pathname.replace('/', ''), 10) || 0
  : 0;

export const bullRedisConnection = {
  host: parsedRedisUrl.hostname || 'localhost',
  port: parsedRedisUrl.port ? parseInt(parsedRedisUrl.port, 10) : 6379,
  username: parsedRedisUrl.username || undefined,
  password: parsedRedisUrl.password || undefined,
  db: dbIndex,
  maxRetriesPerRequest: null,
};

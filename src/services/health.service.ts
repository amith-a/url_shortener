import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import { logger } from '../config/logger.js';

export interface ReadinessResult {
  healthy: boolean;
  db: boolean;
  redis: boolean;
}

export class HealthService {
  constructor(
    private readonly pool: Pool,
    private readonly redisClient: Redis
  ) {}

  async checkReadiness(): Promise<ReadinessResult> {
    let dbHealthy = false;
    let redisHealthy = false;

    try {
      await this.pool.query('SELECT 1');
      dbHealthy = true;
    } catch (err) {
      logger.error({ err }, 'Readiness check failed: PostgreSQL unavailable');
    }

    try {
      const pong = await this.redisClient.ping();
      if (pong === 'PONG') {
        redisHealthy = true;
      } else {
        logger.error(
          { response: pong },
          'Readiness check failed: Redis unexpected ping response'
        );
      }
    } catch (err) {
      logger.error({ err }, 'Readiness check failed: Redis unavailable');
    }

    const healthy = dbHealthy && redisHealthy;

    return {
      healthy,
      db: dbHealthy,
      redis: redisHealthy,
    };
  }
}

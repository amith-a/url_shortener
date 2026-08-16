import pool from '../config/database';
import { redis } from '../config/redis';
import { HealthService } from '../services/health.service';
import { HealthController } from '../controllers/health.controller';

const healthService = new HealthService(pool, redis);
export const healthController = new HealthController(healthService);

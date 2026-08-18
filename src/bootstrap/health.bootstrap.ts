import pool from '../config/database.js';
import { redis } from '../config/redis.js';
import { HealthService } from '../services/health.service.js';
import { HealthController } from '../controllers/health.controller.js';

const healthService = new HealthService(pool, redis);
export const healthController = new HealthController(healthService);

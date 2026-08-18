import { Pool } from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error(err, 'Unexpected error on idle DB client');
});

export default pool;

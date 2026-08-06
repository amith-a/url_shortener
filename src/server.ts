import app from './app';
import pool from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';

async function bootstrap() {
  try {
    await pool.query('SELECT NOW()');

    logger.info('Database connected');

    app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
    });
  } catch (err) {
    logger.error('Database Connection Failed');
    logger.error(err);

    process.exit(1);
  }
}

bootstrap();

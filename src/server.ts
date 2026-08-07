import app from './app';
import pool from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';

async function bootstrap() {
  try {
    await pool.query('SELECT NOW()');

    logger.info('Database connected');

    const server = app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
    });

    const shutdown = (signal: string) => {
      logger.info(`${signal} signal received: closing HTTP server`);
      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          await pool.end();
          logger.info('Database pool drained');
          process.exit(0);
        } catch (err) {
          logger.error(err, 'Error during database pool shutdown');
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Database Connection Failed');
    logger.error(err);

    process.exit(1);
  }
}

bootstrap();

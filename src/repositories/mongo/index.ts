import { getMongoDb } from '../../config/mongo.js';
import { logger } from '../../config/logger.js';
export { MongoUrlRepository } from './mongo-url.repository.js';
export { MongoUrlAnalyticsRepository } from './mongo-url-analytics.repository.js';

export async function ensureMongoIndexes(): Promise<void> {
  try {
    const db = getMongoDb();

    const urlsCollection = db.collection('urls');
    await urlsCollection.createIndex({ short_code: 1 }, { unique: true });
    await urlsCollection.createIndex({ user_id: 1, created_at: -1 });
    await urlsCollection.createIndex({ expires_at: 1 });

    const clickEventsCollection = db.collection('url_click_events');
    await clickEventsCollection.createIndex({ url_id: 1 });

    logger.info('MongoDB indexes ensured successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to create MongoDB indexes');
    throw err;
  }
}

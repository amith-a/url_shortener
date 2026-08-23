import { MongoClient, Db } from 'mongodb';
import { env } from './env.js';
import { logger } from './logger.js';

let client: MongoClient | null = null;
let db: Db | null = null;

export function getMongoClient(): MongoClient {
  if (!client) {
    client = new MongoClient(env.MONGO_URI);
  }
  return client;
}

export function getMongoDb(): Db {
  if (!db) {
    const mongoClient = getMongoClient();
    db = mongoClient.db(env.MONGO_DB_NAME);
  }
  return db;
}

export async function pingMongo(): Promise<boolean> {
  try {
    const mongoDb = getMongoDb();
    const result = await mongoDb.command({ ping: 1 });
    return result.ok === 1;
  } catch (err) {
    logger.error({ err }, 'MongoDB ping failed');
    return false;
  }
}

export async function connectMongoWithRetry(
  maxAttempts = 5,
  initialDelayMs = 1000
): Promise<Db> {
  const mongoClient = getMongoClient();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoClient.connect();
      db = mongoClient.db(env.MONGO_DB_NAME);
      await db.command({ ping: 1 });
      logger.info('MongoDB connected');
      return db;
    } catch (err) {
      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        logger.warn(
          { attempt, delay: delayMs / 1000 },
          `MongoDB connection attempt ${attempt} failed. Retrying in ${delayMs / 1000}s`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        logger.error('MongoDB Connection Failed');
        logger.error(err);
        process.exit(1);
      }
    }
  }
  throw new Error('Failed to connect to MongoDB');
}

export async function closeMongo(): Promise<void> {
  if (client) {
    try {
      await client.close();
      client = null;
      db = null;
      logger.info('MongoDB client closed cleanly');
    } catch (err) {
      logger.error({ err }, 'Error closing MongoDB client');
    }
  }
}

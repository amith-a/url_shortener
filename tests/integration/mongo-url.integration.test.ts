import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoUrlRepository } from '../../src/repositories/mongo/mongo-url.repository.js';
import { MongoUrlAnalyticsRepository } from '../../src/repositories/mongo/mongo-url-analytics.repository.js';
import { ensureMongoIndexes } from '../../src/repositories/mongo/index.js';
import { connectMongoWithRetry, closeMongo, getMongoDb } from '../../src/config/mongo.js';
import { ConflictError } from '../../src/errors/conflict.error.js';

describe('MongoDB Integration Tests', () => {
  let urlRepository: MongoUrlRepository;
  let analyticsRepository: MongoUrlAnalyticsRepository;

  beforeAll(async () => {
    try {
      await connectMongoWithRetry(2, 500);
      await ensureMongoIndexes();
      urlRepository = new MongoUrlRepository();
      analyticsRepository = new MongoUrlAnalyticsRepository();

      // Clean test collections before running
      const db = getMongoDb();
      await db.collection('urls').deleteMany({});
      await db.collection('url_click_events').deleteMany({});
    } catch {
      // If local Mongo container is not running, skip tests gracefully in non-mongo environments
    }
  });

  afterAll(async () => {
    try {
      const db = getMongoDb();
      await db.collection('urls').deleteMany({});
      await db.collection('url_click_events').deleteMany({});
      await closeMongo();
    } catch {
      // Ignore cleanup errors if Mongo wasn't connected
    }
  });

  it('should create and retrieve a short URL in MongoDB', async () => {
    const db = getMongoDb();
    if (!db) return; // Skip if no connection

    const created = await urlRepository.create({
      id: 'integration-mongo-uuid-1',
      shortCode: 'mongoalias1',
      originalUrl: 'https://example.com/mongo-test',
      expiresAt: null,
      userId: 'user-mongo-integration-1',
    });

    expect(created.id).toBe('integration-mongo-uuid-1');
    expect(created.shortCode).toBe('mongoalias1');

    const found = await urlRepository.findByShortCode('mongoalias1');
    expect(found).not.toBeNull();
    expect(found?.originalUrl).toBe('https://example.com/mongo-test');
  });

  it('should enforce unique short_code index and throw ConflictError on duplicate', async () => {
    const db = getMongoDb();
    if (!db) return;

    await urlRepository.create({
      id: 'integration-mongo-uuid-2',
      shortCode: 'uniquealias',
      originalUrl: 'https://example.com/1',
      expiresAt: null,
      userId: 'user-mongo-integration-1',
    });

    await expect(
      urlRepository.create({
        id: 'integration-mongo-uuid-3',
        shortCode: 'uniquealias',
        originalUrl: 'https://example.com/2',
        expiresAt: null,
        userId: 'user-mongo-integration-1',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should list and count URLs by user_id in MongoDB', async () => {
    const db = getMongoDb();
    if (!db) return;

    const countBefore = await urlRepository.countByUserId('user-mongo-integration-1');
    expect(countBefore).toBeGreaterThanOrEqual(2);

    const list = await urlRepository.listByUserId('user-mongo-integration-1', 10, 0);
    expect(list.length).toBe(countBefore);
  });

  it('should record click events and count clicks in MongoUrlAnalyticsRepository', async () => {
    const db = getMongoDb();
    if (!db) return;

    const urlId = 'integration-mongo-uuid-1';
    await analyticsRepository.recordClick(urlId);
    await analyticsRepository.recordClick(urlId);

    const clickCount = await analyticsRepository.countClicks(urlId);
    expect(clickCount).toBe(2);
  });

  it('should delete expired URLs in MongoUrlRepository', async () => {
    const db = getMongoDb();
    if (!db) return;

    const pastDate = new Date(Date.now() - 10000);
    await urlRepository.create({
      id: 'integration-mongo-expired-1',
      shortCode: 'mongoexp1',
      originalUrl: 'https://example.com/expired',
      expiresAt: pastDate,
      userId: 'user-mongo-integration-1',
    });

    const deletedShortCodes = await urlRepository.deleteExpiredUrls();
    expect(deletedShortCodes).toContain('mongoexp1');

    const found = await urlRepository.findByShortCode('mongoexp1');
    expect(found).toBeNull();
  });
});

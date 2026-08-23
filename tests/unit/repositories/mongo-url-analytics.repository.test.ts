import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoUrlAnalyticsRepository } from '../../../src/repositories/mongo/mongo-url-analytics.repository.js';
import * as mongoConfig from '../../../src/config/mongo.js';

describe('MongoUrlAnalyticsRepository', () => {
  let repository: MongoUrlAnalyticsRepository;
  let mockCollection: any;

  beforeEach(() => {
    mockCollection = {
      insertOne: vi.fn(),
      countDocuments: vi.fn(),
    };

    const mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
    };

    vi.spyOn(mongoConfig, 'getMongoDb').mockReturnValue(mockDb as any);
    repository = new MongoUrlAnalyticsRepository();
    vi.restoreAllMocks();
    vi.spyOn(mongoConfig, 'getMongoDb').mockReturnValue(mockDb as any);
  });

  describe('recordClick', () => {
    it('should insert a click event document with current timestamp', async () => {
      mockCollection.insertOne.mockResolvedValue({ acknowledged: true });

      await repository.recordClick('url-uuid-1');

      expect(mockCollection.insertOne).toHaveBeenCalledTimes(1);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          url_id: 'url-uuid-1',
          clicked_at: expect.any(Date),
        })
      );
    });
  });

  describe('countClicks', () => {
    it('should count total click event documents for specified url_id', async () => {
      mockCollection.countDocuments.mockResolvedValue(12);

      const total = await repository.countClicks('url-uuid-1');

      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        url_id: 'url-uuid-1',
      });
      expect(total).toBe(12);
    });
  });
});

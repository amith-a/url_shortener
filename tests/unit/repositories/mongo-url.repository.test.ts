import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoUrlRepository } from '../../../src/repositories/mongo/mongo-url.repository.js';
import * as mongoConfig from '../../../src/config/mongo.js';
import { ConflictError } from '../../../src/errors/conflict.error.js';
import { MongoError } from 'mongodb';

describe('MongoUrlRepository', () => {
  let repository: MongoUrlRepository;
  let mockCollection: any;

  beforeEach(() => {
    mockCollection = {
      insertOne: vi.fn(),
      findOne: vi.fn(),
      findOneAndDelete: vi.fn(),
      find: vi.fn(),
      countDocuments: vi.fn(),
      deleteMany: vi.fn(),
    };

    const mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
    };

    vi.spyOn(mongoConfig, 'getMongoDb').mockReturnValue(mockDb as any);
    repository = new MongoUrlRepository();
    vi.restoreAllMocks();
    vi.spyOn(mongoConfig, 'getMongoDb').mockReturnValue(mockDb as any);
  });

  describe('create', () => {
    it('should insert URL document and return mapped UrlDto', async () => {
      mockCollection.insertOne.mockResolvedValue({ acknowledged: true });

      const result = await repository.create({
        id: 'uuid-mongo-1',
        shortCode: 'mongourl',
        originalUrl: 'https://example.com',
        expiresAt: null,
        userId: 'user-mongo-1',
      });

      expect(mockCollection.insertOne).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('uuid-mongo-1');
      expect(result.shortCode).toBe('mongourl');
      expect(result.originalUrl).toBe('https://example.com');
    });

    it('should throw ConflictError on duplicate key error (code 11000)', async () => {
      const err = new MongoError('E11000 duplicate key error');
      err.code = 11000;
      mockCollection.insertOne.mockRejectedValue(err);

      await expect(
        repository.create({
          id: 'uuid-mongo-1',
          shortCode: 'dupcode',
          originalUrl: 'https://example.com',
          expiresAt: null,
          userId: 'user-mongo-1',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('findByShortCode', () => {
    it('should return UrlDto when document exists', async () => {
      mockCollection.findOne.mockResolvedValue({
        _id: 'uuid-mongo-1',
        short_code: 'mongourl',
        original_url: 'https://example.com',
        created_at: new Date(),
        expires_at: null,
        user_id: 'user-mongo-1',
      });

      const result = await repository.findByShortCode('mongourl');
      expect(result).not.toBeNull();
      expect(result?.shortCode).toBe('mongourl');
    });

    it('should return null when document is not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await repository.findByShortCode('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('deleteByIdAndUserId', () => {
    it('should delete and return short_code when document matches id and user_id', async () => {
      mockCollection.findOneAndDelete.mockResolvedValue({
        _id: 'uuid-mongo-1',
        short_code: 'mongourl',
      });

      const result = await repository.deleteByIdAndUserId('uuid-mongo-1', 'user-mongo-1');
      expect(result).toBe('mongourl');
    });

    it('should return null when no document is matched for deletion', async () => {
      mockCollection.findOneAndDelete.mockResolvedValue(null);

      const result = await repository.deleteByIdAndUserId('uuid-mongo-1', 'other-user');
      expect(result).toBeNull();
    });
  });

  describe('listByUserId', () => {
    it('should query and return list of UrlDtos', async () => {
      const mockCursor = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          {
            _id: 'uuid-mongo-1',
            short_code: 'mongourl',
            original_url: 'https://example.com',
            created_at: new Date(),
            expires_at: null,
            user_id: 'user-mongo-1',
          },
        ]),
      };
      mockCollection.find.mockReturnValue(mockCursor);

      const result = await repository.listByUserId('user-mongo-1', 20, 0);
      expect(result).toHaveLength(1);
      expect(result[0]?.shortCode).toBe('mongourl');
    });
  });

  describe('countByUserId', () => {
    it('should return count of user documents', async () => {
      mockCollection.countDocuments.mockResolvedValue(5);

      const count = await repository.countByUserId('user-mongo-1');
      expect(count).toBe(5);
    });
  });

  describe('deleteExpiredUrls', () => {
    it('should query expired short codes, delete documents, and return short codes', async () => {
      const mockCursor = {
        toArray: vi.fn().mockResolvedValue([
          { short_code: 'exp1' },
          { short_code: 'exp2' },
        ]),
      };
      mockCollection.find.mockReturnValue(mockCursor);
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 2 });

      const result = await repository.deleteExpiredUrls();
      expect(result).toEqual(['exp1', 'exp2']);
      expect(mockCollection.deleteMany).toHaveBeenCalledTimes(1);
    });
  });
});

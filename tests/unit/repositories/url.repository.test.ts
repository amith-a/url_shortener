import { beforeEach, describe, expect, it, vi } from 'vitest';
import pool from '../../../src/config/database';
import { UrlRepository } from '../../../src/repositories/url.repository';
import AppError from '../../../src/errors/app-error';
import { QueryResult } from 'pg';
import { UrlRow } from '../../../src/repositories/types/url.row';

describe('UrlRepository', () => {
  let repository: UrlRepository;

  beforeEach(() => {
    repository = new UrlRepository();
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('should insert a new URL record and return mapped UrlDto', async () => {
      const mockRow: UrlRow = {
        id: 'uuid-1',
        short_code: 'abc12345',
        original_url: 'https://example.com',
        created_at: new Date(),
        expires_at: null,
        user_id: 'user-123',
      };

      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [mockRow],
            command: 'INSERT',
            rowCount: 1,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<UrlRow>
      );

      const result = await repository.create({
        id: 'uuid-1',
        shortCode: 'abc12345',
        originalUrl: 'https://example.com',
        expiresAt: null,
        userId: 'user-123',
      });

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: mockRow.id,
        shortCode: mockRow.short_code,
        originalUrl: mockRow.original_url,
        createdAt: mockRow.created_at,
        expiresAt: mockRow.expires_at,
      });
    });

    it('should throw AppError when database insert returns no row', async () => {
      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [],
            command: 'INSERT',
            rowCount: 0,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<UrlRow>
      );

      await expect(
        repository.create({
          id: 'uuid-1',
          shortCode: 'abc12345',
          originalUrl: 'https://example.com',
          expiresAt: null,
          userId: 'user-123',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('findByShortCode', () => {
    it('should return mapped UrlDto when record exists', async () => {
      const mockRow: UrlRow = {
        id: 'uuid-1',
        short_code: 'abc12345',
        original_url: 'https://example.com',
        created_at: new Date(),
        expires_at: null,
        user_id: 'user-123',
      };

      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [mockRow],
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<UrlRow>
      );

      const result = await repository.findByShortCode('abc12345');

      expect(result).toEqual({
        id: mockRow.id,
        shortCode: mockRow.short_code,
        originalUrl: mockRow.original_url,
        createdAt: mockRow.created_at,
        expiresAt: mockRow.expires_at,
      });
    });

    it('should return null when record does not exist', async () => {
      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [],
            command: 'SELECT',
            rowCount: 0,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<UrlRow>
      );

      const result = await repository.findByShortCode('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteByIdAndUserId', () => {
    it('should return short_code when a row is deleted', async () => {
      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [{ short_code: 'abc12345' }],
            command: 'DELETE',
            rowCount: 1,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<{ short_code: string }>
      );

      const result = await repository.deleteByIdAndUserId('uuid-1', 'user-123');

      expect(result).toBe('abc12345');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM urls'),
        ['uuid-1', 'user-123']
      );
    });

    it('should return null when no row is deleted (ownership mismatch or not found)', async () => {
      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [],
            command: 'DELETE',
            rowCount: 0,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<{ short_code: string }>
      );

      const result = await repository.deleteByIdAndUserId('uuid-1', 'other-user');

      expect(result).toBeNull();
    });
  });

  describe('listByUserId', () => {
    it('should query URLs filtered by user_id with ORDER BY created_at DESC, id DESC, LIMIT and OFFSET', async () => {
      const mockRow: UrlRow = {
        id: 'uuid-1',
        short_code: 'abc12345',
        original_url: 'https://example.com',
        created_at: new Date(),
        expires_at: null,
        user_id: 'user-123',
      };

      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [mockRow],
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<UrlRow>
      );

      const result = await repository.listByUserId('user-123', 20, 0);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC, id DESC'),
        ['user-123', 20, 0]
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.shortCode).toBe('abc12345');
    });
  });

  describe('countByUserId', () => {
    it('should query count of URLs for specified user_id', async () => {
      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [{ total: 42 }],
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<{ total: number }>
      );

      const count = await repository.countByUserId('user-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['user-123']
      );
      expect(count).toBe(42);
    });
  });
});

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
      });

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: mockRow.id,
        shortCode: mockRow.short_code,
        originalUrl: mockRow.original_url,
        createdAt: mockRow.created_at,
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
});

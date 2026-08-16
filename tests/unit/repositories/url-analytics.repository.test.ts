import { beforeEach, describe, expect, it, vi } from 'vitest';
import pool from '../../../src/config/database';
import { UrlAnalyticsRepository } from '../../../src/repositories/url-analytics.repository';
import { QueryResult } from 'pg';

describe('UrlAnalyticsRepository', () => {
  let repository: UrlAnalyticsRepository;

  beforeEach(() => {
    repository = new UrlAnalyticsRepository();
    vi.restoreAllMocks();
  });

  describe('recordClick', () => {
    it('should execute INSERT query with urlId', async () => {
      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [],
            command: 'INSERT',
            rowCount: 1,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<never>
      );

      await repository.recordClick('url-uuid-1');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO url_click_events'),
        ['url-uuid-1']
      );
    });
  });

  describe('countClicks', () => {
    it('should execute COUNT query and return click count number', async () => {
      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [{ total: 15 }],
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<{ total: number }>
      );

      const count = await repository.countClicks('url-uuid-1');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['url-uuid-1']
      );
      expect(count).toBe(15);
    });

    it('should return 0 if no rows returned', async () => {
      vi.spyOn(pool, 'query').mockImplementation(
        async () =>
          ({
            rows: [],
            command: 'SELECT',
            rowCount: 0,
            oid: 0,
            fields: [],
          }) as unknown as QueryResult<{ total: number }>
      );

      const count = await repository.countClicks('url-uuid-1');

      expect(count).toBe(0);
    });
  });
});

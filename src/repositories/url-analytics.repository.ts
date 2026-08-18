import pool from '../config/database.js';
import { IUrlAnalyticsRepository } from './interfaces/url-analytics.repository.interface.js';

export class UrlAnalyticsRepository implements IUrlAnalyticsRepository {
  async recordClick(urlId: string): Promise<void> {
    const query = `
      INSERT INTO url_click_events (url_id)
      VALUES ($1);
    `;

    await pool.query(query, [urlId]);
  }

  async countClicks(urlId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS total
      FROM url_click_events
      WHERE url_id = $1;
    `;

    const result = await pool.query<{ total: number }>(query, [urlId]);

    return result.rows[0]?.total ?? 0;
  }
}

import { CreateUrlDto } from '../dto/create-url.dto';
import pool from '../config/database';
import { UrlDto } from '../dto/url.dto';
import { UrlRow } from './types/url.row';
import AppError from '../errors/app-error';
import { IUrlRepository } from './interfaces/url.repository.interface';

export class UrlRepository implements IUrlRepository {
  async create(urlData: CreateUrlDto): Promise<UrlDto> {
    const query = `
      INSERT INTO urls (
        id,
        short_code,
        original_url,
        expires_at,
        user_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      RETURNING
        id,
        short_code,
        original_url,
        created_at,
        expires_at,
        user_id;
    `;

    const values = [
      urlData.id,
      urlData.shortCode,
      urlData.originalUrl,
      urlData.expiresAt,
      urlData.userId,
    ];

    const result = await pool.query<UrlRow>(query, values);

    const row = result.rows.at(0);

    if (!row) {
      throw new AppError(500, 'Failed to create URL');
    }

    return this.mapToDto(row);
  }

  async findByShortCode(shortCode: string): Promise<UrlDto | null> {
    const query = `
      SELECT
        id,
        short_code,
        original_url,
        created_at,
        expires_at,
        user_id
      FROM urls
      WHERE short_code = $1;
    `;

    const result = await pool.query<UrlRow>(query, [shortCode]);

    const row = result.rows.at(0);

    if (!row) {
      return null;
    }

    return this.mapToDto(row);
  }

  async deleteByIdAndUserId(id: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM urls
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;

    const result = await pool.query<{ id: string }>(query, [id, userId]);

    return (result.rowCount ?? 0) > 0;
  }

  private mapToDto(row: UrlRow): UrlDto {
    return {
      id: row.id,
      shortCode: row.short_code,
      originalUrl: row.original_url,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      userId: row.user_id,
    };
  }
}

import { CreateShortUrlRequestDto } from '../dto/create-short-url-request.dto';
import { UrlDto } from '../dto/url.dto';
import { randomUUID } from 'node:crypto';
import { generateShortCode } from '../utils/short-code';
import { CreateUrlDto } from '../dto/create-url.dto';
import type { UrlRepository } from '../repositories/url.repository';
import { NotFoundError } from '../errors/not-found.error';
import AppError from '../errors/app-error';

const PG_UNIQUE_VIOLATION = '23505';
const MAX_ATTEMPTS = 5;

export class UrlService {
  constructor(private readonly repository: UrlRepository) {}

  private generateId(): string {
    return randomUUID();
  }

  async create(request: CreateShortUrlRequestDto): Promise<UrlDto> {
    const id = this.generateId();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const shortCode = generateShortCode();

      const existing = await this.repository.findByShortCode(shortCode);
      if (existing) {
        continue;
      }

      try {
        const dto: CreateUrlDto = {
          id,
          shortCode,
          originalUrl: request.originalUrl,
        };

        return this.repository.create(dto);
      } catch (err: unknown) {
        const pgError = err as { code?: string };
        if (pgError.code === PG_UNIQUE_VIOLATION && attempt < MAX_ATTEMPTS - 1) {
          continue;
        }
        throw err;
      }
    }

    throw new AppError(500, 'Failed to create short URL due to repeated collisions');
  }

  async resolveShortCode(shortCode: string): Promise<string> {
    const response = await this.repository.findByShortCode(shortCode);

    if (!response) {
      throw new NotFoundError('Short URL not found');
    }

    return response.originalUrl;
  }
}

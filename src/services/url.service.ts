import { CreateShortUrlRequestDto } from '../dto/create-short-url-request.dto';
import { UrlDto } from '../dto/url.dto';
import { randomUUID } from 'node:crypto';
import { generateShortCode } from '../utils/short-code';
import { CreateUrlDto } from '../dto/create-url.dto';
import type { IUrlRepository } from '../repositories/interfaces/url.repository.interface';
import { NotFoundError } from '../errors/not-found.error';
import { ConflictError } from '../errors/conflict.error';
import AppError from '../errors/app-error';
import { logger } from '../config/logger';

const PG_UNIQUE_VIOLATION = '23505';
const MAX_ATTEMPTS = 5;

export class UrlService {
  constructor(private readonly repository: IUrlRepository) {}

  private generateId(): string {
    return randomUUID();
  }

  async create(request: CreateShortUrlRequestDto): Promise<UrlDto> {
    const id = this.generateId();

    if (request.customAlias) {
      try {
        const dto: CreateUrlDto = {
          id,
          shortCode: request.customAlias,
          originalUrl: request.originalUrl,
        };

        const createdUrl = await this.repository.create(dto);
        logger.info({ urlId: createdUrl.id, shortCode: createdUrl.shortCode }, 'Short URL with custom alias created successfully');
        return createdUrl;
      } catch (err: unknown) {
        const pgError = err as { code?: string };
        if (pgError.code === PG_UNIQUE_VIOLATION) {
          logger.warn({ customAlias: request.customAlias }, 'Custom alias collision on DB insert');
          throw new ConflictError('Custom alias is already in use');
        }
        throw err;
      }
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const shortCode = generateShortCode();

      const existing = await this.repository.findByShortCode(shortCode);
      if (existing) {
        logger.warn({ shortCode, attempt: attempt + 1 }, 'Short code collision detected via lookup, retrying');
        continue;
      }

      try {
        const dto: CreateUrlDto = {
          id,
          shortCode,
          originalUrl: request.originalUrl,
        };

        const createdUrl = await this.repository.create(dto);
        logger.info({ urlId: createdUrl.id, shortCode: createdUrl.shortCode }, 'Short URL created successfully');
        return createdUrl;
      } catch (err: unknown) {
        const pgError = err as { code?: string };
        if (pgError.code === PG_UNIQUE_VIOLATION) {
          logger.warn({ shortCode, attempt: attempt + 1 }, 'Short code collision detected on DB insert, retrying');
          continue;
        }
        throw err;
      }
    }

    logger.error({ attempts: MAX_ATTEMPTS }, 'Failed to generate unique short code after max attempts');
    throw new AppError(500, 'Failed to create short URL due to repeated collisions');
  }

  async resolveShortCode(shortCode: string): Promise<string> {
    const response = await this.repository.findByShortCode(shortCode);

    if (!response) {
      logger.warn({ shortCode }, 'Short code resolution failed: resource not found');
      throw new NotFoundError('Short URL not found');
    }

    logger.debug({ shortCode }, 'Short code resolved successfully');
    return response.originalUrl;
  }
}

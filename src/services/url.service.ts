import { CreateShortUrlRequestDto } from '../dto/create-short-url-request.dto';
import { UrlDto } from '../dto/url.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';
import { randomUUID } from 'node:crypto';
import { generateShortCode } from '../utils/short-code';
import { CreateUrlDto } from '../dto/create-url.dto';
import type { IUrlRepository } from '../repositories/interfaces/url.repository.interface';
import type { UrlCacheService } from './url-cache.service';
import { NotFoundError } from '../errors/not-found.error';
import { ConflictError } from '../errors/conflict.error';
import { GoneError } from '../errors/gone.error';
import AppError from '../errors/app-error';
import { logger } from '../config/logger';
import { env } from '../config/env';

const PG_UNIQUE_VIOLATION = '23505';
const MAX_ATTEMPTS = 5;

export class UrlService {
  constructor(
    private readonly repository: IUrlRepository,
    private readonly cacheService: UrlCacheService
  ) {}

  private generateId(): string {
    return randomUUID();
  }

  async create(
    request: CreateShortUrlRequestDto,
    userId: string
  ): Promise<UrlDto> {
    const id = this.generateId();
    const expiresAt = request.expiresAt ? new Date(request.expiresAt) : null;

    if (request.customAlias) {
      try {
        const dto: CreateUrlDto = {
          id,
          shortCode: request.customAlias,
          originalUrl: request.originalUrl,
          expiresAt,
          userId,
        };

        const createdUrl = await this.repository.create(dto);
        logger.info(
          { urlId: createdUrl.id, shortCode: createdUrl.shortCode, userId },
          'Short URL with custom alias created successfully'
        );
        return createdUrl;
      } catch (err: unknown) {
        const pgError = err as { code?: string };
        if (pgError.code === PG_UNIQUE_VIOLATION) {
          logger.warn(
            { customAlias: request.customAlias },
            'Custom alias collision on DB insert'
          );
          throw new ConflictError('Custom alias is already in use');
        }
        throw err;
      }
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const shortCode = generateShortCode();

      const existing = await this.repository.findByShortCode(shortCode);
      if (existing) {
        logger.warn(
          { shortCode, attempt: attempt + 1 },
          'Short code collision detected via lookup, retrying'
        );
        continue;
      }

      try {
        const dto: CreateUrlDto = {
          id,
          shortCode,
          originalUrl: request.originalUrl,
          expiresAt,
          userId,
        };

        const createdUrl = await this.repository.create(dto);
        logger.info(
          { urlId: createdUrl.id, shortCode: createdUrl.shortCode, userId },
          'Short URL created successfully'
        );
        return createdUrl;
      } catch (err: unknown) {
        const pgError = err as { code?: string };
        if (pgError.code === PG_UNIQUE_VIOLATION) {
          logger.warn(
            { shortCode, attempt: attempt + 1 },
            'Short code collision detected on DB insert, retrying'
          );
          continue;
        }
        throw err;
      }
    }

    logger.error(
      { attempts: MAX_ATTEMPTS },
      'Failed to generate unique short code after max attempts'
    );
    throw new AppError(
      500,
      'Failed to create short URL due to repeated collisions'
    );
  }

  async deleteUrl(id: string, userId: string): Promise<void> {
    const deletedShortCode = await this.repository.deleteByIdAndUserId(id, userId);

    if (!deletedShortCode) {
      logger.warn(
        { id, userId },
        'URL deletion failed: URL not found or ownership mismatch'
      );
      throw new NotFoundError('Short URL not found');
    }

    await this.cacheService.delete(deletedShortCode);
    logger.info(
      { id, userId, shortCode: deletedShortCode },
      'Short URL deleted successfully'
    );
  }

  async list(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResponseDto<UrlDto>> {
    const offset = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.repository.listByUserId(userId, limit, offset),
      this.repository.countByUserId(userId),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    logger.debug(
      { userId, page, limit, total, totalPages, count: data.length },
      'Listed user URLs successfully'
    );

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async resolveShortCode(shortCode: string): Promise<string> {
    const cachedUrl = await this.cacheService.get(shortCode);
    if (cachedUrl) {
      logger.debug({ shortCode }, 'Short code resolved from cache successfully');
      return cachedUrl;
    }

    const response = await this.repository.findByShortCode(shortCode);

    if (!response) {
      logger.warn(
        { shortCode },
        'Short code resolution failed: resource not found'
      );
      throw new NotFoundError('Short URL not found');
    }

    if (response.expiresAt !== null && response.expiresAt.getTime() <= Date.now()) {
      logger.warn(
        { shortCode, expiresAt: response.expiresAt },
        'Short code resolution failed: URL has expired'
      );
      await this.cacheService.delete(shortCode);
      throw new GoneError('URL has expired');
    }

    let effectiveTtl = env.REDIS_URL_TTL;
    if (response.expiresAt !== null) {
      const remainingSeconds = Math.floor(
        (response.expiresAt.getTime() - Date.now()) / 1000
      );
      effectiveTtl = Math.min(env.REDIS_URL_TTL, remainingSeconds);
    }

    if (effectiveTtl > 0) {
      await this.cacheService.set(shortCode, response.originalUrl, effectiveTtl);
    }

    logger.debug({ shortCode }, 'Short code resolved successfully');
    return response.originalUrl;
  }
}

import type { IUrlRepository } from '../repositories/interfaces/url.repository.interface';
import type { UrlCacheService } from './url-cache.service';
import { logger } from '../config/logger';

export class UrlCleanupService {
  constructor(
    private readonly repository: IUrlRepository,
    private readonly cacheService: UrlCacheService
  ) {}

  async cleanupExpiredUrls(): Promise<number> {
    try {
      const deletedShortCodes = await this.repository.deleteExpiredUrls();

      if (deletedShortCodes.length === 0) {
        logger.debug('Expired URL cleanup completed: 0 URLs expired');
        return 0;
      }

      for (const shortCode of deletedShortCodes) {
        await this.cacheService.delete(shortCode);
      }

      logger.info(
        { count: deletedShortCodes.length, shortCodes: deletedShortCodes },
        `Expired URL cleanup completed: removed ${deletedShortCodes.length} expired URL(s)`
      );

      return deletedShortCodes.length;
    } catch (err) {
      logger.error({ err }, 'Failed to execute expired URL cleanup');
      throw err;
    }
  }
}

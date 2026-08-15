import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UrlService } from '../../../src/services/url.service';
import type { IUrlRepository } from '../../../src/repositories/interfaces/url.repository.interface';

describe('UrlService', () => {
  let repository: IUrlRepository;
  let service: UrlService;

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findByShortCode: vi.fn(),
    };

    service = new UrlService(repository);
  });

  describe('create', () => {
    it('should create and return a short URL DTO on first attempt', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce(null);
      vi.mocked(repository.create).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'abc12345',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
      });

      const result = await service.create({ originalUrl: 'https://example.com' });

      expect(repository.findByShortCode).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(result.originalUrl).toBe('https://example.com');
    });

    it('should retry when short code exists on initial lookup', async () => {
      const existingDto = {
        id: 'uuid-0',
        shortCode: 'existing',
        originalUrl: 'https://existing.com',
        createdAt: new Date(),
      };

      vi.mocked(repository.findByShortCode)
        .mockResolvedValueOnce(existingDto) // first lookup collision
        .mockResolvedValueOnce(null); // second lookup clear

      vi.mocked(repository.create).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'newcode1',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
      });

      const result = await service.create({ originalUrl: 'https://example.com' });

      expect(repository.findByShortCode).toHaveBeenCalledTimes(2);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(result.shortCode).toBe('newcode1');
    });

    it('should retry when repository throws unique constraint violation (23505)', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValue(null);

      const pgUniqueError = new Error('Unique constraint error');
      (pgUniqueError as unknown as { code: string }).code = '23505';

      vi.mocked(repository.create)
        .mockRejectedValueOnce(pgUniqueError) // first insert collision
        .mockResolvedValueOnce({
          id: 'uuid-2',
          shortCode: 'retry123',
          originalUrl: 'https://example.com',
          createdAt: new Date(),
        });

      const result = await service.create({ originalUrl: 'https://example.com' });

      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(result.shortCode).toBe('retry123');
    });

    it('should throw AppError after max attempts (5) are exceeded', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValue(null);

      const pgUniqueError = new Error('Unique constraint error');
      (pgUniqueError as unknown as { code: string }).code = '23505';

      vi.mocked(repository.create).mockRejectedValue(pgUniqueError);

      await expect(
        service.create({ originalUrl: 'https://example.com' })
      ).rejects.toThrow('Failed to create short URL due to repeated collisions');

      expect(repository.create).toHaveBeenCalledTimes(5);
    });

    it('should create URL with custom alias without performing preliminary lookup', async () => {
      vi.mocked(repository.create).mockResolvedValueOnce({
        id: 'uuid-custom-1',
        shortCode: 'myCustomAlias',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
      });

      const result = await service.create({
        originalUrl: 'https://example.com',
        customAlias: 'myCustomAlias',
      });

      expect(repository.findByShortCode).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shortCode: 'myCustomAlias',
          originalUrl: 'https://example.com',
        })
      );
      expect(result.shortCode).toBe('myCustomAlias');
    });

    it('should throw ConflictError when customAlias produces 23505 unique violation without retry', async () => {
      const pgUniqueError = new Error('Unique constraint error');
      (pgUniqueError as unknown as { code: string }).code = '23505';

      vi.mocked(repository.create).mockRejectedValueOnce(pgUniqueError);

      await expect(
        service.create({
          originalUrl: 'https://example.com',
          customAlias: 'duplicateAlias',
        })
      ).rejects.toThrow('Custom alias is already in use');

      expect(repository.findByShortCode).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveShortCode', () => {
    it('should return original URL when short code exists', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'abc12345',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
      });

      const url = await service.resolveShortCode('abc12345');
      expect(url).toBe('https://example.com');
    });

    it('should throw NotFoundError when short code does not exist', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce(null);

      await expect(service.resolveShortCode('nonexistent')).rejects.toThrow(
        'Short URL not found'
      );
    });
  });
});

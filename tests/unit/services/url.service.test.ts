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
      deleteByIdAndUserId: vi.fn(),
      listByUserId: vi.fn(),
      countByUserId: vi.fn(),
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
        expiresAt: null,
        userId: 'user-123',
      });

      const result = await service.create({ originalUrl: 'https://example.com' }, 'user-123');

      expect(repository.findByShortCode).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
        })
      );
      expect(result.originalUrl).toBe('https://example.com');
    });

    it('should retry when short code exists on initial lookup', async () => {
      const existingDto = {
        id: 'uuid-0',
        shortCode: 'existing',
        originalUrl: 'https://existing.com',
        createdAt: new Date(),
        expiresAt: null,
        userId: 'user-123',
      };

      vi.mocked(repository.findByShortCode)
        .mockResolvedValueOnce(existingDto) // first lookup collision
        .mockResolvedValueOnce(null); // second lookup clear

      vi.mocked(repository.create).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'newcode1',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: null,
        userId: 'user-123',
      });

      const result = await service.create({ originalUrl: 'https://example.com' }, 'user-123');

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
          expiresAt: null,
          userId: 'user-123',
        });

      const result = await service.create({ originalUrl: 'https://example.com' }, 'user-123');

      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(result.shortCode).toBe('retry123');
    });

    it('should throw AppError after max attempts (5) are exceeded', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValue(null);

      const pgUniqueError = new Error('Unique constraint error');
      (pgUniqueError as unknown as { code: string }).code = '23505';

      vi.mocked(repository.create).mockRejectedValue(pgUniqueError);

      await expect(
        service.create({ originalUrl: 'https://example.com' }, 'user-123')
      ).rejects.toThrow('Failed to create short URL due to repeated collisions');

      expect(repository.create).toHaveBeenCalledTimes(5);
    });

    it('should create URL with custom alias without performing preliminary lookup', async () => {
      vi.mocked(repository.create).mockResolvedValueOnce({
        id: 'uuid-custom-1',
        shortCode: 'myCustomAlias',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: null,
        userId: 'user-123',
      });

      const result = await service.create(
        {
          originalUrl: 'https://example.com',
          customAlias: 'myCustomAlias',
        },
        'user-123'
      );

      expect(repository.findByShortCode).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shortCode: 'myCustomAlias',
          originalUrl: 'https://example.com',
          userId: 'user-123',
        })
      );
      expect(result.shortCode).toBe('myCustomAlias');
    });

    it('should throw ConflictError when customAlias produces 23505 unique violation without retry', async () => {
      const pgUniqueError = new Error('Unique constraint error');
      (pgUniqueError as unknown as { code: string }).code = '23505';

      vi.mocked(repository.create).mockRejectedValueOnce(pgUniqueError);

      await expect(
        service.create(
          {
            originalUrl: 'https://example.com',
            customAlias: 'duplicateAlias',
          },
          'user-123'
        )
      ).rejects.toThrow('Custom alias is already in use');

      expect(repository.findByShortCode).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteUrl', () => {
    it('should delete URL successfully when id and userId match', async () => {
      vi.mocked(repository.deleteByIdAndUserId).mockResolvedValueOnce(true);

      await expect(
        service.deleteUrl('url-123', 'user-123')
      ).resolves.toBeUndefined();

      expect(repository.deleteByIdAndUserId).toHaveBeenCalledWith(
        'url-123',
        'user-123'
      );
    });

    it('should throw NotFoundError when deletion fails (no matching row)', async () => {
      vi.mocked(repository.deleteByIdAndUserId).mockResolvedValueOnce(false);

      await expect(
        service.deleteUrl('url-123', 'other-user')
      ).rejects.toThrow('Short URL not found');
    });
  });

  describe('list', () => {
    it('should call listByUserId and countByUserId and combine results into paginated response', async () => {
      const mockDtos = [
        {
          id: 'url-1',
          shortCode: 'code1',
          originalUrl: 'https://example.com/1',
          createdAt: new Date(),
          expiresAt: null,
          userId: 'user-123',
        },
        {
          id: 'url-2',
          shortCode: 'code2',
          originalUrl: 'https://example.com/2',
          createdAt: new Date(),
          expiresAt: null,
          userId: 'user-123',
        },
      ];

      vi.mocked(repository.listByUserId).mockResolvedValueOnce(mockDtos);
      vi.mocked(repository.countByUserId).mockResolvedValueOnce(45);

      const result = await service.list('user-123', 2, 20);

      expect(repository.listByUserId).toHaveBeenCalledWith('user-123', 20, 20);
      expect(repository.countByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        data: mockDtos,
        pagination: {
          page: 2,
          limit: 20,
          total: 45,
          totalPages: 3,
        },
      });
    });

    it('should handle empty user results correctly with totalPages 0', async () => {
      vi.mocked(repository.listByUserId).mockResolvedValueOnce([]);
      vi.mocked(repository.countByUserId).mockResolvedValueOnce(0);

      const result = await service.list('user-empty', 1, 20);

      expect(result).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });
    });

    it('should handle page beyond available data correctly', async () => {
      vi.mocked(repository.listByUserId).mockResolvedValueOnce([]);
      vi.mocked(repository.countByUserId).mockResolvedValueOnce(2);

      const result = await service.list('user-123', 5, 20);

      expect(result).toEqual({
        data: [],
        pagination: {
          page: 5,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });
    });
  });

  describe('resolveShortCode', () => {
    it('should return original URL when short code exists', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'abc12345',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: null,
        userId: 'user-123',
      });

      const url = await service.resolveShortCode('abc12345');
      expect(url).toBe('https://example.com');
    });

    it('should return original URL when expiresAt is in the future', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'future12',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: futureDate,
        userId: 'user-123',
      });

      const url = await service.resolveShortCode('future12');
      expect(url).toBe('https://example.com');
    });

    it('should throw GoneError when URL has expired', async () => {
      const pastDate = new Date(Date.now() - 1000);
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce({
        id: 'uuid-1',
        shortCode: 'expired1',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
        expiresAt: pastDate,
        userId: 'user-123',
      });

      await expect(service.resolveShortCode('expired1')).rejects.toThrow(
        'URL has expired'
      );
    });

    it('should throw NotFoundError when short code does not exist', async () => {
      vi.mocked(repository.findByShortCode).mockResolvedValueOnce(null);

      await expect(service.resolveShortCode('nonexistent')).rejects.toThrow(
        'Short URL not found'
      );
    });
  });
});

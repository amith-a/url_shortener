import { CreateUrlDto } from '../../dto/create-url.dto';
import { UrlDto } from '../../dto/url.dto';

export interface IUrlRepository {
  create(urlData: CreateUrlDto): Promise<UrlDto>;
  findByShortCode(shortCode: string): Promise<UrlDto | null>;
  deleteByIdAndUserId(id: string, userId: string): Promise<string | null>;
  findByIdAndUserId(id: string, userId: string): Promise<UrlDto | null>;
  listByUserId(
    userId: string,
    limit: number,
    offset: number
  ): Promise<UrlDto[]>;
  countByUserId(userId: string): Promise<number>;
  deleteExpiredUrls(): Promise<string[]>;
}

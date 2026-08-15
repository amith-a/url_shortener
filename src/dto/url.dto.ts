export interface UrlDto {
  id: string;
  shortCode: string;
  originalUrl: string;
  createdAt: Date;
  expiresAt: Date | null;
  userId: string | null;
}

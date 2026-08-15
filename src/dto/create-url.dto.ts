export interface CreateUrlDto {
  id: string;
  shortCode: string;
  originalUrl: string;
  expiresAt: Date | null;
}

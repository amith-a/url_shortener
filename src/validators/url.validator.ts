import { z } from 'zod';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254',
  '::1',
  '[::1]',
]);

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.')
  )
    return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  return false;
}

export const urlSchema = z.object({
  originalUrl: z
    .string()
    .trim()
    .max(2048, 'URL length exceeds maximum limit of 2048 characters')
    .url('Invalid URL format')
    .refine((url) => {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return false;
        }
        if (isPrivateHostname(parsed.hostname)) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }, 'Only public HTTP and HTTPS URLs are allowed'),
  customAlias: z
    .string()
    .trim()
    .min(3, 'Custom alias must be at least 3 characters')
    .max(50, 'Custom alias must not exceed 50 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Invalid custom alias format')
    .optional(),
  expiresAt: z
    .string()
    .datetime({ offset: true, message: 'Invalid ISO 8601 date format with timezone offset' })
    .refine((val) => new Date(val) > new Date(), 'Expiration time must be in the future')
    .optional(),
});

export const getUrlSchema = z.object({
  shortCode: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9]+$/, 'Invalid short code'),
});

export type CreateShortUrlRequest = z.infer<typeof urlSchema>;
export type GetUrlRequest = z.infer<typeof getUrlSchema>;

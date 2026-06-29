import { ConfigService } from '@nestjs/config';

/**
 * Parse a comma-separated origins string into a trimmed, de-duplicated array.
 * Works with raw env strings (before Nest DI is available) or ConfigService.
 */
export function parseWebOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Parse the comma-separated WEB_ORIGINS env var via ConfigService.
 */
export function getWebOrigins(config: ConfigService): string[] {
  return parseWebOrigins(config.getOrThrow<string>('WEB_ORIGINS'));
}

/**
 * Returns true if `origin` is in the allowed WEB_ORIGINS list.
 */
export function isAllowedOrigin(origin: string | undefined, config: ConfigService): boolean {
  if (!origin) return false;
  return getWebOrigins(config).includes(origin);
}

/**
 * Whether any allowed origin uses HTTPS — used to decide if cookies should be
 * marked `secure`.
 */
export function usesHttps(config: ConfigService): boolean {
  return getWebOrigins(config).some((o) => o.startsWith('https://'));
}
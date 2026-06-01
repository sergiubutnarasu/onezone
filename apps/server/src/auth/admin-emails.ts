import { ConfigService } from '@nestjs/config';

export function getAdminEmails(config: ConfigService): string[] {
  return config
    .get<string>('ADMIN_EMAILS', '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(config: ConfigService, email: string): boolean {
  return getAdminEmails(config).includes(email.toLowerCase());
}
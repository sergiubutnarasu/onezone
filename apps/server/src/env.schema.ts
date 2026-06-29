import { z } from 'zod';

export const EnvSchema = z.object({
  JWT_SECRET: z.string().min(32),
  // Comma-separated list of allowed web origins (e.g. "http://localhost:5025,http://personal-macbook-pro.voltri.local:5025")
  WEB_ORIGINS: z.string().min(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),
  ADMIN_EMAILS: z.string(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
});
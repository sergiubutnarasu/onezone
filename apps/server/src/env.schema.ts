import { z } from 'zod';

export const EnvSchema = z.object({
  JWT_SECRET: z.string().min(32),
  WEB_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),
  ADMIN_EMAILS: z.string(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
});
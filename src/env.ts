import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SENTRY_DSN: z.string().optional(),
  POSTMARK_TOKEN: z.string().optional(),
  BATCH_API_KEY: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().optional(),
  DEFAULT_TZ: z.string().default("America/New_York"),
  ORG_MONTHLY_CAP_BATCH_USD: z.string().default("50"),
  PORT: z.string().optional(),
  NODE_ENV: z.string().default("development"),
});

export const env = EnvSchema.parse(process.env);

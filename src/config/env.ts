import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // Supabase JWKS URL, e.g. https://YOUR_PROJECT.supabase.co/auth/v1/keys
  // Made optional for dev mode - real auth requires this
  SUPABASE_JWKS_URL: z.string().url().optional(),

  // Dev bypass: allow fake headers to simulate auth locally
  DEV_AUTH_BYPASS: z
    .string()
    .optional()
    .transform((v: string | undefined) => v === "true"),

  // keep anything else you already had here…
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  DEFAULT_TZ: z.string().default("America/New_York"),
});

export const env = EnvSchema.parse(process.env);

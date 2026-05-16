import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    JWT_PRIVATE_KEY: z.string().min(1),
    JWT_PUBLIC_KEY: z.string().min(1),
    DATABASE_ENCRYPTION_KEY: z.string().length(64),
    APP_URL: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

import { z } from "zod";

const optionalString = (schema: z.ZodString) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema.optional(),
  );

const envSchema = z.object({
  DATA_MODE: z.enum(["demo", "supabase"]).default("demo"),
  AI_ANALYSIS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SUPABASE_URL: optionalString(z.string().url()),
  SUPABASE_SERVICE_ROLE_KEY: optionalString(z.string().min(1)),
  N8N_WEBHOOK_URL: optionalString(z.string().url()),
  N8N_SHARED_SECRET: z.string().min(16).default("development-only-secret"),
  SLACK_WEBHOOK_URL: optionalString(z.string().url()),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  cached ??= envSchema.parse(process.env);
  if (
    cached.DATA_MODE === "supabase" &&
    (!cached.SUPABASE_URL || !cached.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in supabase mode.",
    );
  }
  return cached;
}

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("environment configuration", () => {
  it("treats blank optional integration values as unset in demo mode", async () => {
    vi.stubEnv("DATA_MODE", "demo");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("N8N_WEBHOOK_URL", "");
    vi.stubEnv("SLACK_WEBHOOK_URL", "");

    const { getEnv } = await import("./env");
    const env = getEnv();

    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.N8N_WEBHOOK_URL).toBeUndefined();
    expect(env.SLACK_WEBHOOK_URL).toBeUndefined();
  });

  it("still requires Supabase credentials in Supabase mode", async () => {
    vi.stubEnv("DATA_MODE", "supabase");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { getEnv } = await import("./env");

    expect(() => getEnv()).toThrow(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in supabase mode.",
    );
  });

  it("rejects a nonblank malformed integration URL", async () => {
    vi.stubEnv("DATA_MODE", "demo");
    vi.stubEnv("N8N_WEBHOOK_URL", "not-a-url");

    const { getEnv } = await import("./env");

    expect(() => getEnv()).toThrow();
  });
});

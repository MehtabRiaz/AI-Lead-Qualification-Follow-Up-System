import { getEnv } from "@/lib/env";
import { DemoLeadRepository } from "./demo-repository";
import type { LeadRepository } from "./repository";
import { SupabaseLeadRepository } from "./supabase-repository";

let repository: LeadRepository | undefined;

export function getLeadRepository(): LeadRepository {
  if (repository) return repository;
  const env = getEnv();
  repository =
    env.DATA_MODE === "supabase"
      ? new SupabaseLeadRepository(
          env.SUPABASE_URL!,
          env.SUPABASE_SERVICE_ROLE_KEY!,
        )
      : new DemoLeadRepository();
  return repository;
}

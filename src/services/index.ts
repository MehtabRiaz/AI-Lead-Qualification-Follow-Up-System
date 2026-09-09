import { getLeadRepository } from "@/data";
import { getEnv } from "@/lib/env";
import { LeadService } from "./lead-service";

export function getLeadService() {
  return new LeadService(getLeadRepository(), {
    aiAnalysisEnabled: getEnv().AI_ANALYSIS_ENABLED,
  });
}

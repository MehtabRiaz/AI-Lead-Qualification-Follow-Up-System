import { getLeadRepository } from "@/data";
import { getLeadAnalyzer } from "@/integrations/lead-analyzer";
import { LeadService } from "./lead-service";

export function getLeadService() {
  return new LeadService(getLeadRepository(), getLeadAnalyzer());
}

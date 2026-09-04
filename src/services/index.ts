import { getLeadRepository } from "@/data";
import { LeadService } from "./lead-service";

export function getLeadService() {
  return new LeadService(getLeadRepository());
}

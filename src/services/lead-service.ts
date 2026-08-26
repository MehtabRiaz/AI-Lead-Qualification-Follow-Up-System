import { randomUUID } from "node:crypto";
import { qualifyLead } from "@/domain/qualification";
import { leadInputSchema, type LeadInput } from "@/domain/schemas";
import type { LeadRepository } from "@/data/repository";
import type { LeadAnalyzer } from "@/integrations/lead-analyzer";

export class LeadService {
  constructor(
    private readonly repository: LeadRepository,
    private readonly analyzer: LeadAnalyzer,
  ) {}

  async acceptSubmission(raw: unknown, idempotencyKey: string) {
    const lead = leadInputSchema.parse(raw);
    const existingLead = await this.repository.findByEmail(lead.workEmail);
    return this.repository.createSubmission({
      id: randomUUID(),
      leadId: existingLead?.leadId ?? randomUUID(),
      idempotencyKey,
      lead,
      createdAt: new Date().toISOString(),
    });
  }

  async processSubmission(id: string) {
    const record = await this.repository.findSubmission(id);
    if (!record) throw new Error("SUBMISSION_NOT_FOUND");
    if (
      record.workflowStatus === "COMPLETED" ||
      record.workflowStatus === "HUMAN_REVIEW"
    )
      return record;

    const duplicate = await this.repository.findByEmail(
      record.lead.workEmail,
      record.id,
    );
    const duplicateState = duplicate ? "DUPLICATE_CONFIRMED" : "NEW";
    const preflight = qualifyLead(record.lead, { duplicateState });
    await this.repository.updateWorkflow(id, {
      workflowStatus: "PROCESSING",
      attempts: record.attempts + 1,
      errorCode: null,
    });

    let result = preflight;
    if (
      preflight.gates.validation === "VALID" &&
      duplicateState === "NEW" &&
      preflight.gates.qualificationData !== "INSUFFICIENT"
    ) {
      try {
        const aiAnalysis = await this.analyzer.analyze(record.lead);
        result = qualifyLead(record.lead, { duplicateState, aiAnalysis });
      } catch {
        result = qualifyLead(record.lead, {
          duplicateState,
          aiFailureReason: "AI_ANALYSIS_UNAVAILABLE",
        });
      }
    }

    return this.repository.updateWorkflow(id, {
      workflowStatus:
        result.routing.route === "HUMAN_REVIEW" ||
        result.routing.route === "VERIFY_IDENTITY"
          ? "HUMAN_REVIEW"
          : "COMPLETED",
      result,
      errorCode:
        result.analysis.aiStatus === "FALLBACK"
          ? "AI_ANALYSIS_UNAVAILABLE"
          : null,
    });
  }
}

export function publicReceipt(record: { id: string; createdAt: string }) {
  return {
    accepted: true,
    submissionId: record.id,
    receivedAt: record.createdAt,
    message: "Thanks — your request has been received.",
  };
}

export function normalizeIdempotencyKey(
  value: string | null,
  lead: LeadInput,
): string {
  return (
    value?.trim() ||
    `${lead.workEmail.toLowerCase()}:${lead.companyName.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`
  );
}

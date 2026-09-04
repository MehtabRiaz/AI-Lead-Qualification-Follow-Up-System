import { randomUUID } from "node:crypto";
import { qualifyLead } from "@/domain/qualification";
import {
  aiAnalysisSchema,
  leadInputSchema,
  type AiAnalysis,
  type LeadInput,
} from "@/domain/schemas";
import type { LeadRepository, SubmissionRecord } from "@/data/repository";

export class LeadService {
  constructor(private readonly repository: LeadRepository) {}

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

  async prepareSubmission(id: string) {
    const record = await this.repository.findSubmission(id);
    if (!record) throw new Error("SUBMISSION_NOT_FOUND");
    if (
      record.workflowStatus === "COMPLETED" ||
      record.workflowStatus === "HUMAN_REVIEW"
    )
      return { analysisRequired: false as const, record };

    const duplicate = await this.repository.findByEmail(
      record.lead.workEmail,
      record.id,
    );
    const duplicateState = duplicate ? "DUPLICATE_CONFIRMED" : "NEW";
    const preflight = qualifyLead(record.lead, { duplicateState });
    const analysisRequired =
      preflight.gates.validation === "VALID" &&
      duplicateState === "NEW" &&
      preflight.gates.qualificationData !== "INSUFFICIENT";

    if (analysisRequired)
      return {
        analysisRequired: true as const,
        submissionId: record.id,
        analysisInput: {
          industry: record.lead.industry,
          roleTitle: record.lead.roleTitle,
          seniority: record.lead.seniority,
          serviceNeeded: record.lead.serviceNeeded,
          timeline: record.lead.timeline,
          currentChallenge: record.lead.currentChallenge,
          message: record.lead.message,
        },
      };

    const updated = await this.persistResult(record, preflight);
    return { analysisRequired: false as const, record: updated };
  }

  async completeSubmission(
    id: string,
    input:
      | { aiAnalysis: AiAnalysis; aiFailureReason?: never }
      | { aiAnalysis?: never; aiFailureReason: string },
  ) {
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
    const result = input.aiAnalysis
      ? qualifyLead(record.lead, {
          duplicateState,
          aiAnalysis: aiAnalysisSchema.parse(input.aiAnalysis),
        })
      : qualifyLead(record.lead, {
          duplicateState,
          aiFailureReason: input.aiFailureReason,
        });

    return this.persistResult(record, result);
  }

  private async persistResult(
    record: SubmissionRecord,
    result: ReturnType<typeof qualifyLead>,
  ) {
    await this.repository.updateWorkflow(record.id, {
      workflowStatus: "PROCESSING",
      attempts: record.attempts + 1,
      errorCode: null,
    });
    return this.repository.updateWorkflow(record.id, {
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

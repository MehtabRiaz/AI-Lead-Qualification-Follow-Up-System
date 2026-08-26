import type { LeadInput, QualificationResult } from "@/domain/schemas";

export type WorkflowStatus =
  | "PENDING_AUTOMATION"
  | "PROCESSING"
  | "COMPLETED"
  | "RETRYABLE_FAILURE"
  | "HUMAN_REVIEW";

export interface SubmissionRecord {
  id: string;
  idempotencyKey: string;
  leadId: string;
  lead: LeadInput;
  createdAt: string;
  workflowStatus: WorkflowStatus;
  attempts: number;
  result: QualificationResult | null;
  errorCode: string | null;
}

export interface FollowUpRecord {
  id: string;
  leadId: string;
  submissionId: string;
  sequence: string;
  checkpoint: "T24H" | "T72H" | "T7D";
  dueAt: string;
  status: "SCHEDULED" | "DRAFTED" | "CANCELLED" | "FAILED";
}

export interface LeadRepository {
  createSubmission(input: {
    id: string;
    leadId: string;
    idempotencyKey: string;
    lead: LeadInput;
    createdAt: string;
  }): Promise<{ record: SubmissionRecord; replay: boolean }>;
  findSubmission(id: string): Promise<SubmissionRecord | null>;
  findByEmail(
    email: string,
    excludingSubmissionId?: string,
  ): Promise<SubmissionRecord | null>;
  listPending(limit: number): Promise<SubmissionRecord[]>;
  listRecent(limit: number): Promise<SubmissionRecord[]>;
  updateWorkflow(
    id: string,
    patch: Partial<
      Pick<
        SubmissionRecord,
        "workflowStatus" | "attempts" | "result" | "errorCode"
      >
    >,
  ): Promise<SubmissionRecord>;
  processDueFollowUps(now: string, limit: number): Promise<FollowUpRecord[]>;
}

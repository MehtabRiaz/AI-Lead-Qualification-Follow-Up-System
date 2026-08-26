import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { leadInputSchema, qualificationResultSchema } from "@/domain/schemas";
import type {
  FollowUpRecord,
  LeadRepository,
  SubmissionRecord,
  WorkflowStatus,
} from "./repository";

interface SubmissionRow {
  id: string;
  idempotency_key: string;
  lead_id: string;
  normalized_payload: unknown;
  created_at: string;
  workflow_status: WorkflowStatus;
  attempts: number;
  qualification_result: unknown;
  error_code: string | null;
}

function fromRow(row: SubmissionRow): SubmissionRecord {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    leadId: row.lead_id,
    lead: leadInputSchema.parse(row.normalized_payload),
    createdAt: row.created_at,
    workflowStatus: row.workflow_status,
    attempts: row.attempts,
    result: row.qualification_result
      ? qualificationResultSchema.parse(row.qualification_result)
      : null,
    errorCode: row.error_code,
  };
}

export class SupabaseLeadRepository implements LeadRepository {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async createSubmission(input: {
    id: string;
    leadId: string;
    idempotencyKey: string;
    lead: SubmissionRecord["lead"];
    createdAt: string;
  }) {
    const { data: existing } = await this.client
      .from("lead_submissions")
      .select("*")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing)
      return { record: fromRow(existing as SubmissionRow), replay: true };

    const { error: leadError } = await this.client.from("leads").upsert(
      {
        id: input.leadId,
        normalized_email: input.lead.workEmail.toLowerCase(),
        company_name: input.lead.companyName,
        current_status: "NEW",
      },
      { onConflict: "normalized_email", ignoreDuplicates: true },
    );
    if (leadError) throw leadError;
    const { data, error } = await this.client
      .from("lead_submissions")
      .insert({
        id: input.id,
        lead_id: input.leadId,
        idempotency_key: input.idempotencyKey,
        normalized_payload: input.lead,
        raw_payload: input.lead,
        created_at: input.createdAt,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { record: fromRow(data as SubmissionRow), replay: false };
  }

  async findSubmission(id: string) {
    const { data, error } = await this.client
      .from("lead_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as SubmissionRow) : null;
  }

  async findByEmail(email: string, excludingSubmissionId?: string) {
    let query = this.client
      .from("lead_submissions")
      .select("*")
      .contains("normalized_payload", { workEmail: email.toLowerCase() })
      .order("created_at", { ascending: false })
      .limit(1);
    if (excludingSubmissionId) query = query.neq("id", excludingSubmissionId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as SubmissionRow) : null;
  }

  async listPending(limit: number) {
    const { data, error } = await this.client
      .from("lead_submissions")
      .select("*")
      .in("workflow_status", ["PENDING_AUTOMATION", "RETRYABLE_FAILURE"])
      .order("created_at")
      .limit(limit);
    if (error) throw error;
    return (data as SubmissionRow[]).map(fromRow);
  }

  async listRecent(limit: number) {
    const { data, error } = await this.client
      .from("lead_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as SubmissionRow[]).map(fromRow);
  }

  async updateWorkflow(
    id: string,
    patch: Partial<
      Pick<
        SubmissionRecord,
        "workflowStatus" | "attempts" | "result" | "errorCode"
      >
    >,
  ) {
    const dbPatch = {
      ...(patch.workflowStatus
        ? { workflow_status: patch.workflowStatus }
        : {}),
      ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
      ...(patch.result !== undefined
        ? { qualification_result: patch.result }
        : {}),
      ...(patch.errorCode !== undefined ? { error_code: patch.errorCode } : {}),
    };
    const { data, error } = await this.client
      .from("lead_submissions")
      .update(dbPatch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    const record = fromRow(data as SubmissionRow);
    if (patch.result) {
      const result = patch.result;
      const { error: resultError } = await this.client
        .from("qualification_results")
        .upsert(
          {
            submission_id: record.id,
            version: result.version,
            classification: result.decision.classification,
            score: result.decision.score,
            result,
            prompt_version:
              result.analysis.aiStatus === "USED" ? "lead-analysis-v1" : null,
          },
          { onConflict: "submission_id,version" },
        );
      if (resultError) throw resultError;

      const { error: activityError } = await this.client
        .from("activities")
        .insert({
          lead_id: record.leadId,
          submission_id: record.id,
          event_type: "QUALIFICATION_COMPLETED",
          actor_type: "SYSTEM",
          metadata: {
            classification: result.decision.classification,
            route: result.routing.route,
            score: result.decision.score,
          },
        });
      if (activityError) throw activityError;

      if (result.routing.followUpSequence !== "NONE") {
        const hour = 60 * 60 * 1000;
        const checkpoints = [
          ["T24H", 24],
          ["T72H", 72],
          ["T7D", 168],
        ] as const;
        const rows = checkpoints.map(([checkpoint, hours]) => ({
          lead_id: record.leadId,
          submission_id: record.id,
          sequence: result.routing.followUpSequence,
          checkpoint,
          due_at: new Date(Date.now() + hours * hour).toISOString(),
        }));
        const { error: followUpError } = await this.client
          .from("follow_ups")
          .upsert(rows, {
            onConflict: "lead_id,sequence,checkpoint",
            ignoreDuplicates: true,
          });
        if (followUpError) throw followUpError;
      }
    }
    return record;
  }

  async processDueFollowUps(now: string, limit: number) {
    const { data, error } = await this.client
      .from("follow_ups")
      .select("*")
      .eq("status", "SCHEDULED")
      .lte("due_at", now)
      .order("due_at")
      .limit(limit);
    if (error) throw error;

    const processed: FollowUpRecord[] = [];
    for (const row of data) {
      const { data: submission, error: submissionError } = await this.client
        .from("lead_submissions")
        .select("normalized_payload")
        .eq("id", row.submission_id)
        .single();
      if (submissionError) throw submissionError;
      const lead = leadInputSchema.parse(submission.normalized_payload);
      const { error: draftError } = await this.client
        .from("outbound_drafts")
        .insert({
          lead_id: row.lead_id,
          submission_id: row.submission_id,
          channel: "EMAIL",
          subject: `Following up with ${lead.companyName}`,
          body: `Draft ${row.checkpoint}: Follow up on ${lead.currentChallenge}`,
          generated_by: "deterministic_follow_up_v1",
        });
      if (draftError) throw draftError;
      const { error: updateError } = await this.client
        .from("follow_ups")
        .update({ status: "DRAFTED", updated_at: now })
        .eq("id", row.id);
      if (updateError) throw updateError;
      processed.push({
        id: row.id as string,
        leadId: row.lead_id as string,
        submissionId: row.submission_id as string,
        sequence: row.sequence as string,
        checkpoint: row.checkpoint as FollowUpRecord["checkpoint"],
        dueAt: row.due_at as string,
        status: "DRAFTED",
      });
    }
    return processed;
  }
}

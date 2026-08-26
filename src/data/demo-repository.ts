import { randomUUID } from "node:crypto";
import { testFixtures } from "@/domain/fixtures";
import { qualifyLead } from "@/domain/qualification";
import type {
  FollowUpRecord,
  LeadRepository,
  SubmissionRecord,
} from "./repository";

const state = globalThis as unknown as {
  __leadDemoStore?: Map<string, SubmissionRecord>;
  __leadDemoFollowUps?: Map<string, FollowUpRecord>;
};

function seededStore(): Map<string, SubmissionRecord> {
  const store = new Map<string, SubmissionRecord>();
  const now = Date.now();
  for (const [index, fixture] of testFixtures.entries()) {
    const id = `demo-${index + 1}`;
    store.set(id, {
      id,
      leadId: randomUUID(),
      idempotencyKey: id,
      lead: fixture.lead,
      createdAt: new Date(now - index * 3_600_000).toISOString(),
      workflowStatus:
        fixture.expected.route === "HUMAN_REVIEW" ||
        fixture.expected.route === "VERIFY_IDENTITY"
          ? "HUMAN_REVIEW"
          : "COMPLETED",
      attempts: 1,
      result: qualifyLead(fixture.lead, {
        aiAnalysis: fixture.ai,
        duplicateState: fixture.duplicateState,
      }),
      errorCode: null,
    });
  }
  return store;
}

const store = (state.__leadDemoStore ??= seededStore());
const followUps = (state.__leadDemoFollowUps ??= new Map<
  string,
  FollowUpRecord
>());

export class DemoLeadRepository implements LeadRepository {
  async createSubmission(input: {
    id: string;
    leadId: string;
    idempotencyKey: string;
    lead: SubmissionRecord["lead"];
    createdAt: string;
  }) {
    const existing = [...store.values()].find(
      (record) => record.idempotencyKey === input.idempotencyKey,
    );
    if (existing) return { record: existing, replay: true };
    const record: SubmissionRecord = {
      ...input,
      workflowStatus: "PENDING_AUTOMATION",
      attempts: 0,
      result: null,
      errorCode: null,
    };
    store.set(record.id, record);
    return { record, replay: false };
  }

  async findSubmission(id: string) {
    return store.get(id) ?? null;
  }

  async findByEmail(email: string, excludingSubmissionId?: string) {
    return (
      [...store.values()].find(
        (record) =>
          record.id !== excludingSubmissionId &&
          record.lead.workEmail.toLowerCase() === email.toLowerCase(),
      ) ?? null
    );
  }

  async listPending(limit: number) {
    return [...store.values()]
      .filter(
        (record) =>
          record.workflowStatus === "PENDING_AUTOMATION" ||
          record.workflowStatus === "RETRYABLE_FAILURE",
      )
      .slice(0, limit);
  }

  async listRecent(limit: number) {
    return [...store.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
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
    const record = store.get(id);
    if (!record) throw new Error("SUBMISSION_NOT_FOUND");
    const updated = { ...record, ...patch };
    store.set(id, updated);
    if (patch.result && patch.result.routing.followUpSequence !== "NONE") {
      const checkpoints = [
        ["T24H", 24],
        ["T72H", 72],
        ["T7D", 168],
      ] as const;
      for (const [checkpoint, hours] of checkpoints) {
        const followUpId = `${record.leadId}:${patch.result.routing.followUpSequence}:${checkpoint}`;
        if (!followUps.has(followUpId)) {
          followUps.set(followUpId, {
            id: followUpId,
            leadId: record.leadId,
            submissionId: record.id,
            sequence: patch.result.routing.followUpSequence,
            checkpoint,
            dueAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
            status: "SCHEDULED",
          });
        }
      }
    }
    return updated;
  }

  async processDueFollowUps(now: string, limit: number) {
    const due = [...followUps.values()]
      .filter((item) => item.status === "SCHEDULED" && item.dueAt <= now)
      .slice(0, limit);
    for (const item of due)
      followUps.set(item.id, { ...item, status: "DRAFTED" });
    return due.map((item) => ({ ...item, status: "DRAFTED" as const }));
  }
}

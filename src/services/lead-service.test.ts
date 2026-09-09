import { describe, expect, it } from "vitest";
import { DemoLeadRepository } from "@/data/demo-repository";
import type { AiAnalysis, LeadInput } from "@/domain/schemas";
import { LeadService } from "./lead-service";

const lead: LeadInput = {
  contactName: "Workflow Test",
  workEmail: "workflow-agent-test@example.dev",
  companyName: "Workflow Agent Test",
  website: "https://example.dev",
  roleTitle: "VP Marketing",
  seniority: "VP",
  industry: "B2B_SAAS",
  employeeCount: 50,
  annualRevenueUsd: 5_000_000,
  monthlyAdSpendUsd: 30_000,
  serviceNeeded: "PAID_ACQUISITION",
  geography: "United States",
  currentChallenge: "Our acquisition cost increased 35% this quarter.",
  leadSource: "test",
  timeline: "WITHIN_30_DAYS",
  message: null,
};

const aiAnalysis: AiAnalysis = {
  problemSummary: "Acquisition cost increased 35%.",
  intentSummary: "Actively evaluating paid acquisition help.",
  intentLevel: "ACTIVE_EVALUATION",
  problemAwareness: "QUANTIFIED",
  urgencySignals: ["WITHIN_30_DAYS"],
  riskSignals: [],
  recommendedAction: "Offer a discovery call.",
  evidence: [
    {
      type: "problem",
      sourceText: "acquisition cost increased 35%",
      confidence: 0.9,
    },
  ],
};

describe("n8n-owned lead analysis contract", () => {
  it("prepares an eligible submission without analyzing it in the application", async () => {
    const service = new LeadService(new DemoLeadRepository(), {
      aiAnalysisEnabled: true,
    });
    const accepted = await service.acceptSubmission(
      lead,
      "agent-contract-prepare",
    );

    const prepared = await service.prepareSubmission(accepted.record.id);

    expect(prepared.analysisRequired).toBe(true);
    if (prepared.analysisRequired) {
      expect(prepared.analysisInput.currentChallenge).toBe(
        lead.currentChallenge,
      );
      expect("monthlyAdSpendUsd" in prepared.analysisInput).toBe(false);
    }
  });

  it("completes deterministically without requesting AI when disabled", async () => {
    const service = new LeadService(new DemoLeadRepository(), {
      aiAnalysisEnabled: false,
    });
    const accepted = await service.acceptSubmission(
      { ...lead, workEmail: "workflow-ai-disabled@example.dev" },
      "agent-contract-disabled",
    );

    const prepared = await service.prepareSubmission(accepted.record.id);

    expect(prepared.analysisRequired).toBe(false);
    if (!prepared.analysisRequired) {
      expect(prepared.record.result?.analysis.aiStatus).toBe("SKIPPED");
      expect(prepared.record.errorCode).toBeNull();
    }
  });

  it("validates agent output and completes deterministic qualification", async () => {
    const service = new LeadService(new DemoLeadRepository());
    const accepted = await service.acceptSubmission(
      { ...lead, workEmail: "workflow-agent-complete@example.dev" },
      "agent-contract-complete",
    );

    const completed = await service.completeSubmission(accepted.record.id, {
      aiAnalysis,
    });

    expect(completed.workflowStatus).toBe("COMPLETED");
    expect(completed.result?.analysis.aiStatus).toBe("USED");
    expect(completed.result?.decision.score).not.toBeNull();
  });

  it("routes a failed workflow analysis to human review", async () => {
    const service = new LeadService(new DemoLeadRepository());
    const accepted = await service.acceptSubmission(
      { ...lead, workEmail: "workflow-agent-failure@example.dev" },
      "agent-contract-failure",
    );

    const completed = await service.completeSubmission(accepted.record.id, {
      aiFailureReason: "AI_ANALYSIS_UNAVAILABLE",
    });

    expect(completed.workflowStatus).toBe("HUMAN_REVIEW");
    expect(completed.result?.analysis.aiStatus).toBe("FALLBACK");
  });
});

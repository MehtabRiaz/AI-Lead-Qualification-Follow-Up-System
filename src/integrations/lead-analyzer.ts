import OpenAI from "openai";
import {
  aiAnalysisSchema,
  type AiAnalysis,
  type LeadInput,
} from "@/domain/schemas";
import { getEnv } from "@/lib/env";

export interface LeadAnalyzer {
  analyze(lead: LeadInput): Promise<AiAnalysis>;
}

const jsonSchema = {
  type: "object",
  properties: {
    problemSummary: { type: "string" },
    intentSummary: { type: "string" },
    intentLevel: {
      type: "string",
      enum: ["RESEARCH", "DIAGNOSTIC", "ACTIVE_HELP", "ACTIVE_EVALUATION"],
    },
    problemAwareness: {
      type: "string",
      enum: ["VAGUE", "CLEAR", "QUANTIFIED", "QUANTIFIED_WITH_CONSEQUENCE"],
    },
    urgencySignals: { type: "array", items: { type: "string" } },
    riskSignals: { type: "array", items: { type: "string" } },
    recommendedAction: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          sourceText: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["type", "sourceText", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "problemSummary",
    "intentSummary",
    "intentLevel",
    "problemAwareness",
    "urgencySignals",
    "riskSignals",
    "recommendedAction",
    "evidence",
  ],
  additionalProperties: false,
} as const;

export class OpenAiLeadAnalyzer implements LeadAnalyzer {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async analyze(lead: LeadInput): Promise<AiAnalysis> {
    const response = await this.client.responses.create(
      {
        model: this.model,
        instructions:
          "Analyze only supplied lead information. Extract the stated problem, buying intent, urgency, risk evidence, and a concise action. Never infer missing commercial or identity data. Never calculate a numerical lead score.",
        input: JSON.stringify({
          industry: lead.industry,
          roleTitle: lead.roleTitle,
          seniority: lead.seniority,
          serviceNeeded: lead.serviceNeeded,
          timeline: lead.timeline,
          currentChallenge: lead.currentChallenge,
          message: lead.message,
        }),
        max_output_tokens: 700,
        text: {
          format: {
            type: "json_schema",
            name: "lead_analysis_v1",
            strict: true,
            schema: jsonSchema,
          },
        },
      },
      { timeout: 15_000 },
    );
    return aiAnalysisSchema.parse(JSON.parse(response.output_text));
  }
}

class DemoLeadAnalyzer implements LeadAnalyzer {
  async analyze(lead: LeadInput): Promise<AiAnalysis> {
    const text = `${lead.currentChallenge} ${lead.message ?? ""}`.toLowerCase();
    const hasNumber = /\d+%|\$\d+|\d+x/.test(text);
    const riskSignals = /guarantee|guaranteed|5x/.test(text)
      ? ["Guarantee or extreme outcome requested."]
      : [];
    return aiAnalysisSchema.parse({
      problemSummary: lead.currentChallenge,
      intentSummary:
        lead.timeline === "SIX_PLUS_MONTHS"
          ? "Researching a future option."
          : "Interested in external help.",
      intentLevel:
        lead.timeline === "SIX_PLUS_MONTHS"
          ? "RESEARCH"
          : lead.timeline === "WITHIN_30_DAYS" || lead.timeline === "IMMEDIATE"
            ? "ACTIVE_EVALUATION"
            : "ACTIVE_HELP",
      problemAwareness: hasNumber ? "QUANTIFIED" : "CLEAR",
      urgencySignals: lead.timeline === "NO_DEADLINE" ? [] : [lead.timeline],
      riskSignals,
      recommendedAction: riskSignals.length
        ? "Request senior review before making commitments."
        : "Offer a discovery conversation.",
      evidence: [
        {
          type: "problem",
          sourceText: lead.currentChallenge.slice(0, 300),
          confidence: 0.8,
        },
      ],
    });
  }
}

export function getLeadAnalyzer(): LeadAnalyzer {
  const env = getEnv();
  return env.OPENAI_API_KEY
    ? new OpenAiLeadAnalyzer(env.OPENAI_API_KEY, env.OPENAI_MODEL)
    : new DemoLeadAnalyzer();
}

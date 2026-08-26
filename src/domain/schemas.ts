import { z } from "zod";

export const industries = [
  "B2B_SAAS",
  "ECOMMERCE",
  "LOCAL_BUSINESS",
  "OTHER",
] as const;
export const services = [
  "PAID_ACQUISITION",
  "GROWTH_MARKETING",
  "SEO",
  "OTHER",
] as const;
export const seniorities = [
  "UNKNOWN",
  "IC",
  "COORDINATOR",
  "MANAGER",
  "DIRECTOR",
  "HEAD",
  "VP",
  "FOUNDER",
  "C_SUITE",
] as const;
export const timelines = [
  "IMMEDIATE",
  "THIS_WEEK",
  "WITHIN_30_DAYS",
  "NO_DEADLINE",
  "SIX_PLUS_MONTHS",
] as const;

const nullableNumber = z.number().nonnegative().nullable().default(null);

export const leadInputSchema = z.object({
  contactName: z.string().trim().min(2).max(100),
  workEmail: z.string().trim().email().max(254),
  companyName: z.string().trim().min(2).max(160),
  website: z.string().trim().url().max(300),
  roleTitle: z.string().trim().max(120).nullable().default(null),
  seniority: z.enum(seniorities).default("UNKNOWN"),
  industry: z.enum(industries),
  employeeCount: nullableNumber,
  annualRevenueUsd: nullableNumber,
  monthlyAdSpendUsd: nullableNumber,
  serviceNeeded: z.enum(services),
  geography: z.string().trim().min(2).max(100),
  currentChallenge: z.string().trim().min(10).max(2000),
  leadSource: z.string().trim().min(2).max(100).default("website_form"),
  timeline: z.enum(timelines).default("NO_DEADLINE"),
  message: z.string().trim().max(3000).nullable().default(null),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export const aiAnalysisSchema = z.object({
  problemSummary: z.string().min(1).max(500),
  intentSummary: z.string().min(1).max(500),
  intentLevel: z.enum([
    "RESEARCH",
    "DIAGNOSTIC",
    "ACTIVE_HELP",
    "ACTIVE_EVALUATION",
  ]),
  problemAwareness: z.enum([
    "VAGUE",
    "CLEAR",
    "QUANTIFIED",
    "QUANTIFIED_WITH_CONSEQUENCE",
  ]),
  urgencySignals: z.array(z.string().max(240)).max(8),
  riskSignals: z.array(z.string().max(240)).max(8),
  recommendedAction: z.string().min(1).max(500),
  evidence: z
    .array(
      z.object({
        type: z.string().max(80),
        sourceText: z.string().max(300),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(10),
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;

export const validationStates = ["VALID", "SUSPICIOUS", "INVALID"] as const;
export const duplicateStates = [
  "NEW",
  "DUPLICATE_CONFIRMED",
  "POSSIBLE_DUPLICATE",
  "EXISTING_ACCOUNT_NEW_CONTACT",
] as const;
export const completenessStates = [
  "SUFFICIENT",
  "PARTIAL",
  "INSUFFICIENT",
] as const;
export const riskStates = ["NORMAL", "ELEVATED", "HIGH"] as const;
export const urgencyStates = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type DuplicateState = (typeof duplicateStates)[number];

export const qualificationResultSchema = z.object({
  version: z.literal("1.0"),
  decision: z.object({
    classification: z.enum([
      "HOT",
      "WARM",
      "LOW_FIT",
      "UNCONFIRMED",
      "HUMAN_REVIEW",
      "SUSPICIOUS",
      "INVALID",
      "DUPLICATE",
    ]),
    score: z.number().min(0).max(100).nullable(),
    provisional: z.boolean(),
    dataCompleteness: z.number().min(0).max(100),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  }),
  gates: z.object({
    validation: z.enum(validationStates),
    duplicate: z.enum(duplicateStates),
    qualificationData: z.enum(completenessStates),
    risk: z.enum(riskStates),
    urgency: z.enum(urgencyStates),
  }),
  scores: z.object({
    commercialValue: z.number().min(0).max(25).nullable(),
    icpFit: z.number().min(0).max(20).nullable(),
    buyingIntent: z.number().min(0).max(20).nullable(),
    authority: z.number().min(0).max(15).nullable(),
    problemAwareness: z.number().min(0).max(10).nullable(),
    geographyServiceability: z.number().min(0).max(10).nullable(),
    earned: z.number().nonnegative(),
    availableMaximum: z.number().min(0).max(100),
    total: z.number().min(0).max(100).nullable(),
  }),
  analysis: z.object({
    problemSummary: z.string(),
    intentSummary: z.string(),
    keySignals: z.array(z.string()),
    missingInformation: z.array(z.string()),
    riskSignals: z.array(z.string()),
    evidence: aiAnalysisSchema.shape.evidence,
    aiStatus: z.enum(["USED", "FALLBACK", "SKIPPED"]),
  }),
  routing: z.object({
    route: z.enum([
      "STOP",
      "VERIFY_IDENTITY",
      "UPDATE_EXISTING_RECORD",
      "HUMAN_REVIEW",
      "PRIORITY_QUALIFICATION",
      "IMMEDIATE_ACTION",
      "PRIORITY_SALES",
      "HOT_SALES_QUEUE",
      "HIGH_VALUE_NURTURE",
      "NORMAL_SALES_QUEUE",
      "NURTURE",
      "QUICK_HUMAN_CHECK",
      "LOW_PRIORITY",
    ]),
    recommendedAction: z.string(),
    slaHours: z.number().nonnegative().nullable(),
    followUpSequence: z.enum([
      "NONE",
      "HOT_LEAD",
      "WARM_LEAD",
      "NURTURE",
      "QUALIFICATION",
    ]),
  }),
  reasons: z.array(z.string()),
});

export type QualificationResult = z.infer<typeof qualificationResultSchema>;

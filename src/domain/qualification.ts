import type {
  AiAnalysis,
  DuplicateState,
  LeadInput,
  QualificationResult,
} from "./schemas";

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
]);
const TARGET_INDUSTRIES = new Set(["B2B_SAAS", "ECOMMERCE"]);
const TARGET_SERVICES = new Set(["PAID_ACQUISITION", "GROWTH_MARKETING"]);
const US_MARKERS = [
  "united states",
  "usa",
  "u.s.",
  "us",
  "austin",
  "new york",
  "california",
  "texas",
];
const ENGLISH_MARKETS = [
  "united kingdom",
  "uk",
  "canada",
  "australia",
  "new zealand",
  "ireland",
];

export interface QualificationContext {
  duplicateState?: DuplicateState;
  aiAnalysis?: AiAnalysis | null;
  aiFailureReason?: string | null;
}

function hostname(value: string): string {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
}

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function validateIdentity(lead: LeadInput): {
  state: "VALID" | "SUSPICIOUS";
  reasons: string[];
} {
  const emailHost = emailDomain(lead.workEmail);
  const siteHost = hostname(lead.website);
  const genericMismatch =
    PUBLIC_EMAIL_DOMAINS.has(emailHost) && emailHost !== siteHost;
  const implausiblyLargeClaim =
    (lead.annualRevenueUsd ?? 0) >= 50_000_000 ||
    (lead.monthlyAdSpendUsd ?? 0) >= 250_000;

  if (genericMismatch && implausiblyLargeClaim) {
    return {
      state: "SUSPICIOUS",
      reasons: [
        "Generic email conflicts with the claimed company domain.",
        "Extreme commercial claims require identity verification.",
      ],
    };
  }

  return { state: "VALID", reasons: [] };
}

function commercialValue(lead: LeadInput): number | null {
  const spend = lead.monthlyAdSpendUsd;
  if (spend !== null) {
    if (spend >= 50_000) return 25;
    if (spend >= 15_000) return 22;
    if (spend >= 5_000) return 15;
    if (spend >= 1_000) return 8;
    return 2;
  }
  const revenue = lead.annualRevenueUsd;
  if (revenue === null) return null;
  if (revenue >= 20_000_000) return 25;
  if (revenue >= 5_000_000) return 22;
  if (revenue >= 1_000_000) return 15;
  if (revenue >= 250_000) return 8;
  return 2;
}

function icpFit(lead: LeadInput): number {
  return (
    (TARGET_INDUSTRIES.has(lead.industry)
      ? 12
      : lead.industry === "OTHER"
        ? 4
        : 2) +
    (TARGET_SERVICES.has(lead.serviceNeeded)
      ? 8
      : lead.serviceNeeded === "SEO"
        ? 4
        : 1)
  );
}

function buyingIntent(analysis: AiAnalysis | null): number | null {
  if (!analysis) return null;
  return {
    RESEARCH: 4,
    DIAGNOSTIC: 10,
    ACTIVE_HELP: 15,
    ACTIVE_EVALUATION: 20,
  }[analysis.intentLevel];
}

function authority(lead: LeadInput): number | null {
  return {
    UNKNOWN: null,
    IC: 3,
    COORDINATOR: 4,
    MANAGER: 8,
    DIRECTOR: 12,
    HEAD: 12,
    VP: 15,
    FOUNDER: 15,
    C_SUITE: 15,
  }[lead.seniority];
}

function problemAwareness(analysis: AiAnalysis | null): number | null {
  if (!analysis) return null;
  return { VAGUE: 2, CLEAR: 5, QUANTIFIED: 8, QUANTIFIED_WITH_CONSEQUENCE: 10 }[
    analysis.problemAwareness
  ];
}

function geography(lead: LeadInput): number {
  const value = lead.geography.toLowerCase();
  if (US_MARKERS.some((marker) => value === marker || value.includes(marker)))
    return 10;
  if (
    ENGLISH_MARKETS.some((marker) => value === marker || value.includes(marker))
  )
    return 7;
  return 4;
}

function urgency(lead: LeadInput): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (lead.timeline === "IMMEDIATE") return "CRITICAL";
  if (lead.timeline === "THIS_WEEK" || lead.timeline === "WITHIN_30_DAYS")
    return "HIGH";
  if (lead.timeline === "SIX_PLUS_MONTHS") return "LOW";
  return "MEDIUM";
}

function risk(analysis: AiAnalysis | null): "NORMAL" | "ELEVATED" | "HIGH" {
  if (!analysis || analysis.riskSignals.length === 0) return "NORMAL";
  const joined = analysis.riskSignals.join(" ").toLowerCase();
  if (
    /guarantee|illegal|compliance|impossible|5x|takeover.*immediate/.test(
      joined,
    )
  )
    return "HIGH";
  return "ELEVATED";
}

function routeFor(
  classification: "HOT" | "WARM" | "LOW_FIT",
  urgencyState: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
) {
  if (classification === "HOT") {
    if (urgencyState === "CRITICAL")
      return ["IMMEDIATE_ACTION", 4, "HOT_LEAD"] as const;
    if (urgencyState === "HIGH")
      return ["PRIORITY_SALES", 24, "HOT_LEAD"] as const;
    if (urgencyState === "MEDIUM")
      return ["HOT_SALES_QUEUE", 72, "HOT_LEAD"] as const;
    return ["HIGH_VALUE_NURTURE", null, "NURTURE"] as const;
  }
  if (classification === "WARM") {
    if (urgencyState === "CRITICAL" || urgencyState === "HIGH")
      return ["PRIORITY_QUALIFICATION", 24, "QUALIFICATION"] as const;
    if (urgencyState === "MEDIUM")
      return ["NORMAL_SALES_QUEUE", 72, "WARM_LEAD"] as const;
    return ["NURTURE", null, "NURTURE"] as const;
  }
  if (urgencyState === "CRITICAL" || urgencyState === "HIGH")
    return ["QUICK_HUMAN_CHECK", 24, "QUALIFICATION"] as const;
  return ["LOW_PRIORITY", null, "NURTURE"] as const;
}

export function qualifyLead(
  lead: LeadInput,
  context: QualificationContext = {},
): QualificationResult {
  const validation = validateIdentity(lead);
  const duplicateState = context.duplicateState ?? "NEW";
  const urgencyState = urgency(lead);
  const analysis = context.aiAnalysis ?? null;
  const riskState = risk(analysis);
  const scoreParts = {
    commercialValue: commercialValue(lead),
    icpFit: icpFit(lead),
    buyingIntent: buyingIntent(analysis),
    authority: authority(lead),
    problemAwareness: problemAwareness(analysis),
    geographyServiceability: geography(lead),
  };
  const maximums = {
    commercialValue: 25,
    icpFit: 20,
    buyingIntent: 20,
    authority: 15,
    problemAwareness: 10,
    geographyServiceability: 10,
  };
  const entries = Object.entries(scoreParts) as [
    keyof typeof scoreParts,
    number | null,
  ][];
  const earned = entries.reduce((sum, [, value]) => sum + (value ?? 0), 0);
  const availableMaximum = entries.reduce(
    (sum, [key, value]) => sum + (value === null ? 0 : maximums[key]),
    0,
  );
  const availableDimensions = entries.filter(
    ([, value]) => value !== null,
  ).length;
  const hasRequiredDimension =
    scoreParts.icpFit !== null &&
    (scoreParts.commercialValue !== null || scoreParts.buyingIntent !== null);
  const qualificationData =
    availableDimensions >= 5 && hasRequiredDimension
      ? "SUFFICIENT"
      : availableDimensions >= 3
        ? "PARTIAL"
        : "INSUFFICIENT";
  const completeness = Math.round((availableMaximum / 100) * 100);
  const total =
    qualificationData === "INSUFFICIENT" || availableMaximum === 0
      ? null
      : Math.round((earned / availableMaximum) * 100);
  const baseClassification =
    total === null
      ? "UNCONFIRMED"
      : total >= 80
        ? "HOT"
        : total >= 55
          ? "WARM"
          : "LOW_FIT";

  let classification: QualificationResult["decision"]["classification"] =
    baseClassification;
  let route: QualificationResult["routing"]["route"];
  let action: string;
  let slaHours: number | null = null;
  let sequence: QualificationResult["routing"]["followUpSequence"] = "NONE";

  if (validation.state === "SUSPICIOUS") {
    classification = "SUSPICIOUS";
    route = "VERIFY_IDENTITY";
    action = "Verify the submitted identity before sales outreach.";
  } else if (duplicateState === "DUPLICATE_CONFIRMED") {
    classification = "DUPLICATE";
    route = "UPDATE_EXISTING_RECORD";
    action =
      "Update the canonical lead, append activity, and keep the existing follow-up state.";
  } else if (duplicateState === "POSSIBLE_DUPLICATE") {
    classification = "HUMAN_REVIEW";
    route = "HUMAN_REVIEW";
    action = "Review the possible duplicate before merging records.";
  } else if (qualificationData === "INSUFFICIENT") {
    classification = "UNCONFIRMED";
    route = "PRIORITY_QUALIFICATION";
    action = "Collect the missing qualification information.";
    slaHours = urgencyState === "HIGH" || urgencyState === "CRITICAL" ? 24 : 72;
    sequence = "QUALIFICATION";
  } else if (riskState === "HIGH" || context.aiFailureReason) {
    classification = "HUMAN_REVIEW";
    route = "HUMAN_REVIEW";
    action = context.aiFailureReason
      ? "Review the lead because AI analysis was unavailable."
      : "Senior review is required before any commitment.";
    slaHours = urgencyState === "CRITICAL" ? 4 : 24;
  } else if (qualificationData === "PARTIAL") {
    classification = "UNCONFIRMED";
    route = "PRIORITY_QUALIFICATION";
    action =
      "Review the provisional score and collect the missing information.";
    slaHours = urgencyState === "HIGH" || urgencyState === "CRITICAL" ? 24 : 72;
    sequence = "QUALIFICATION";
  } else {
    const routed = routeFor(
      baseClassification as "HOT" | "WARM" | "LOW_FIT",
      urgencyState,
    );
    [route, slaHours, sequence] = routed;
    action =
      analysis?.recommendedAction ??
      "Review the lead and choose the next appropriate action.";
  }

  const missingInformation = entries
    .filter(([, value]) => value === null)
    .map(([key]) => key);
  return {
    version: "1.0",
    decision: {
      classification,
      score: total,
      provisional: qualificationData === "PARTIAL",
      dataCompleteness: completeness,
      confidence:
        qualificationData === "SUFFICIENT" && analysis
          ? "HIGH"
          : qualificationData === "INSUFFICIENT"
            ? "LOW"
            : "MEDIUM",
    },
    gates: {
      validation: validation.state,
      duplicate: duplicateState,
      qualificationData,
      risk: riskState,
      urgency: urgencyState,
    },
    scores: { ...scoreParts, earned, availableMaximum, total },
    analysis: {
      problemSummary: analysis?.problemSummary ?? lead.currentChallenge,
      intentSummary: analysis?.intentSummary ?? "AI analysis was not used.",
      keySignals: analysis?.evidence.map((item) => item.sourceText) ?? [],
      missingInformation,
      riskSignals: analysis?.riskSignals ?? [],
      evidence: analysis?.evidence ?? [],
      aiStatus: analysis
        ? "USED"
        : context.aiFailureReason
          ? "FALLBACK"
          : "SKIPPED",
    },
    routing: {
      route,
      recommendedAction: action,
      slaHours,
      followUpSequence: sequence,
    },
    reasons: [
      ...validation.reasons,
      ...(context.aiFailureReason ? [context.aiFailureReason] : []),
    ],
  };
}

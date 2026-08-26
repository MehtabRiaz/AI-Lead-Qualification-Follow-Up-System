import { describe, expect, it } from "vitest";
import { testFixtures } from "./fixtures";
import { qualifyLead } from "./qualification";
import { qualificationResultSchema } from "./schemas";

describe("qualification fixtures", () => {
  for (const fixture of testFixtures) {
    it(`routes ${fixture.name}`, () => {
      const result = qualifyLead(fixture.lead, {
        aiAnalysis: fixture.ai,
        duplicateState: fixture.duplicateState,
      });
      expect(result.decision.classification).toBe(
        fixture.expected.classification,
      );
      expect(result.routing.route).toBe(fixture.expected.route);
      expect(() => qualificationResultSchema.parse(result)).not.toThrow();
    });
  }
});

describe("qualification invariants", () => {
  it("does not convert unknown data to zero", () => {
    const lead = testFixtures[4]!.lead;
    const result = qualifyLead(lead);
    expect(result.scores.commercialValue).toBeNull();
    expect(result.scores.authority).toBeNull();
    expect(result.decision.score).toBeNull();
  });

  it("routes AI failures to review without losing the deterministic score", () => {
    const fixture = testFixtures[0]!;
    const result = qualifyLead(fixture.lead, {
      aiAnalysis: fixture.ai,
      aiFailureReason: "AI_TIMEOUT",
    });
    expect(result.routing.route).toBe("HUMAN_REVIEW");
    expect(result.analysis.aiStatus).toBe("USED");
  });

  it("labels partial scores provisional and unconfirmed", () => {
    const lead = { ...testFixtures[0]!.lead, seniority: "UNKNOWN" as const };
    const result = qualifyLead(lead);
    expect(result.gates.qualificationData).toBe("PARTIAL");
    expect(result.decision.provisional).toBe(true);
    expect(result.decision.classification).toBe("UNCONFIRMED");
    expect(result.routing.route).toBe("PRIORITY_QUALIFICATION");
  });
});

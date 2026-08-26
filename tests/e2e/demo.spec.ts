import { expect, test } from "@playwright/test";

test("renders the public form without internal decisions", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Growth gets easier/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit request" }),
  ).toBeVisible();
  await expect(page.getByText(/qualification score/i)).toHaveCount(0);
});

test("renders fictional qualification results in the internal demo", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Signal, without the noise." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ScaleFlow" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Apex Commerce")).toBeVisible();
});

test("submission receipt is idempotent and hides internal output", async ({
  request,
}) => {
  const payload = {
    contactName: "Test Lead",
    workEmail: "lead@e2e.example",
    companyName: "E2E SaaS",
    website: "https://e2e.example",
    roleTitle: "VP Marketing",
    seniority: "VP",
    industry: "B2B_SAAS",
    employeeCount: 35,
    annualRevenueUsd: 4_000_000,
    monthlyAdSpendUsd: 30_000,
    serviceNeeded: "PAID_ACQUISITION",
    geography: "United States",
    currentChallenge:
      "Our CPL increased 40% and the team needs help this month.",
    leadSource: "website_form",
    timeline: "WITHIN_30_DAYS",
    message: null,
  };
  const headers = { "idempotency-key": "playwright-e2e-replay" };
  const first = await request.post("/api/leads", { data: payload, headers });
  const replay = await request.post("/api/leads", { data: payload, headers });
  expect(first.status()).toBe(202);
  expect(replay.status()).toBe(200);
  const firstBody = await first.json();
  const replayBody = await replay.json();
  expect(replayBody.submissionId).toBe(firstBody.submissionId);
  expect(firstBody.score).toBeUndefined();
  expect(firstBody.route).toBeUndefined();
});

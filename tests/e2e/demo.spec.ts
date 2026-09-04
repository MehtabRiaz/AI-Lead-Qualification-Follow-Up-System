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

test("successful form submission resets safely and shows its receipt", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("Form Reset Test");
  await page.getByLabel("Work email").fill("form-reset-test@example.dev");
  await page
    .getByRole("textbox", { name: "Company", exact: true })
    .fill("Form Reset Test Company");
  await page.getByLabel("Website").fill("https://example.dev");
  await page.getByLabel("Role/title").fill("VP Marketing");
  await page.getByLabel("Seniority").selectOption("VP");
  await page.getByLabel("Company type").selectOption("B2B_SAAS");
  await page.getByLabel("Service needed").selectOption("PAID_ACQUISITION");
  await page.getByLabel("Employees").fill("85");
  await page.getByLabel("Annual revenue (USD)").fill("8000000");
  await page.getByLabel("Monthly ad spend (USD)").fill("30000");
  await page.getByLabel("Primary market").fill("United States");
  await page.getByLabel("Decision timeline").selectOption("WITHIN_30_DAYS");
  await page
    .getByLabel("Current challenge")
    .fill("Customer acquisition cost increased 40% this quarter.");

  await page.getByRole("button", { name: "Submit request" }).click();

  await expect(page.getByText(/Request received\. Reference:/)).toBeVisible();
  await expect(page.getByText(/Cannot read properties of null/)).toHaveCount(0);
  await expect(page.getByLabel("Name")).toHaveValue("");
});

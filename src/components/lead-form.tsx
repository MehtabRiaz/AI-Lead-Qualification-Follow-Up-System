"use client";

import { useState, type FormEvent } from "react";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; id: string }
  | { kind: "error"; message: string };

export function LeadForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "submitting" });
    const form = event.currentTarget;
    const data = new FormData(form);
    const numberOrNull = (name: string) =>
      data.get(name) ? Number(data.get(name)) : null;
    const body = {
      contactName: data.get("contactName"),
      workEmail: data.get("workEmail"),
      companyName: data.get("companyName"),
      website: data.get("website"),
      roleTitle: data.get("roleTitle") || null,
      seniority: data.get("seniority"),
      industry: data.get("industry"),
      employeeCount: numberOrNull("employeeCount"),
      annualRevenueUsd: numberOrNull("annualRevenueUsd"),
      monthlyAdSpendUsd: numberOrNull("monthlyAdSpendUsd"),
      serviceNeeded: data.get("serviceNeeded"),
      geography: data.get("geography"),
      currentChallenge: data.get("currentChallenge"),
      leadSource: "website_form",
      timeline: data.get("timeline"),
      message: data.get("message") || null,
    };
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        accepted?: boolean;
        submissionId?: string;
        message?: string;
      };
      if (!response.ok || !result.accepted || !result.submissionId)
        throw new Error(result.message || "Please try again.");
      setState({ kind: "success", id: result.submissionId });
      form.reset();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <div className="field-row">
        <label>
          Name
          <input
            name="contactName"
            required
            minLength={2}
            autoComplete="name"
          />
        </label>
        <label>
          Work email
          <input name="workEmail" type="email" required autoComplete="email" />
        </label>
      </div>
      <div className="field-row">
        <label>
          Company
          <input name="companyName" required autoComplete="organization" />
        </label>
        <label>
          Website
          <input
            name="website"
            type="url"
            required
            placeholder="https://example.com"
          />
        </label>
      </div>
      <div className="field-row">
        <label>
          Role/title
          <input name="roleTitle" autoComplete="organization-title" />
        </label>
        <label>
          Seniority
          <select name="seniority" defaultValue="UNKNOWN">
            <option value="UNKNOWN">Prefer not to say</option>
            <option value="COORDINATOR">Coordinator</option>
            <option value="MANAGER">Manager</option>
            <option value="DIRECTOR">Director</option>
            <option value="HEAD">Head</option>
            <option value="VP">VP</option>
            <option value="FOUNDER">Founder</option>
            <option value="C_SUITE">C-suite</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label>
          Company type
          <select name="industry" required defaultValue="">
            <option value="" disabled>
              Select one
            </option>
            <option value="B2B_SAAS">B2B / SaaS</option>
            <option value="ECOMMERCE">E-commerce</option>
            <option value="LOCAL_BUSINESS">Local business</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label>
          Service needed
          <select name="serviceNeeded" required defaultValue="">
            <option value="" disabled>
              Select one
            </option>
            <option value="PAID_ACQUISITION">Paid acquisition</option>
            <option value="GROWTH_MARKETING">Growth marketing</option>
            <option value="SEO">SEO</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>
      <div className="field-row thirds">
        <label>
          Employees
          <input name="employeeCount" type="number" min="0" />
        </label>
        <label>
          Annual revenue (USD)
          <input name="annualRevenueUsd" type="number" min="0" />
        </label>
        <label>
          Monthly ad spend (USD)
          <input name="monthlyAdSpendUsd" type="number" min="0" />
        </label>
      </div>
      <div className="field-row">
        <label>
          Primary market
          <input name="geography" required placeholder="United States" />
        </label>
        <label>
          Decision timeline
          <select name="timeline" defaultValue="NO_DEADLINE">
            <option value="IMMEDIATE">Immediate</option>
            <option value="THIS_WEEK">This week</option>
            <option value="WITHIN_30_DAYS">Within 30 days</option>
            <option value="NO_DEADLINE">No fixed deadline</option>
            <option value="SIX_PLUS_MONTHS">6+ months</option>
          </select>
        </label>
      </div>
      <label>
        Current challenge
        <textarea
          name="currentChallenge"
          required
          minLength={10}
          rows={4}
          placeholder="What is underperforming, and what impact is it having?"
        />
      </label>
      <label>
        Anything else? <span className="optional">Optional</span>
        <textarea name="message" rows={3} />
      </label>
      <div className="submit-row">
        <button
          className="button primary"
          disabled={state.kind === "submitting"}
        >
          {state.kind === "submitting" ? "Submitting…" : "Submit request"}
        </button>
        <span>Mock data only · Internal scoring stays private</span>
      </div>
      <div aria-live="polite">
        {state.kind === "success" && (
          <p className="notice success">
            Request received. Reference: <code>{state.id}</code>
          </p>
        )}
        {state.kind === "error" && (
          <p className="notice error">{state.message}</p>
        )}
      </div>
    </form>
  );
}

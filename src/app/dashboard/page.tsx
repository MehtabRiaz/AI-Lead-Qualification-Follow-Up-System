import Link from "next/link";
import { getLeadRepository } from "@/data";

export const dynamic = "force-dynamic";

function tone(value: string) {
  if (["HOT", "COMPLETED", "VALID"].includes(value)) return "positive";
  if (["HUMAN_REVIEW", "SUSPICIOUS", "HIGH"].includes(value)) return "danger";
  if (["WARM", "UNCONFIRMED", "PENDING_AUTOMATION"].includes(value))
    return "warning";
  return "neutral";
}

export default async function DashboardPage() {
  const records = await getLeadRepository().listRecent(30);
  const reviewCount = records.filter(
    (record) => record.workflowStatus === "HUMAN_REVIEW",
  ).length;
  return (
    <main className="dashboard">
      <header className="dash-header shell">
        <div>
          <Link className="brand" href="/">
            Northstar<span>Growth</span>
          </Link>
          <div className="demo-label">Internal demo</div>
        </div>
        <Link className="text-link" href="/">
          ← Public form
        </Link>
      </header>
      <section className="shell dash-title">
        <div>
          <div className="kicker">Lead intelligence</div>
          <h1>Signal, without the noise.</h1>
          <p>
            Read-only qualification results generated from fictional portfolio
            data.
          </p>
        </div>
        <div className="stats">
          <div>
            <strong>{records.length}</strong>
            <span>Recent leads</span>
          </div>
          <div>
            <strong>{reviewCount}</strong>
            <span>Need review</span>
          </div>
        </div>
      </section>
      <section className="shell lead-list" aria-label="Qualified leads">
        {records.map((record) => {
          const result = record.result;
          return (
            <article className="lead-card" key={record.id}>
              <div className="lead-main">
                <div className="company-mark">
                  {record.lead.companyName.slice(0, 1)}
                </div>
                <div>
                  <h2>{record.lead.companyName}</h2>
                  <p>
                    {record.lead.contactName} ·{" "}
                    {record.lead.roleTitle ||
                      record.lead.seniority.replaceAll("_", " ")}
                  </p>
                  <div className="badges">
                    <span
                      className={tone(
                        result?.decision.classification ||
                          record.workflowStatus,
                      )}
                    >
                      {result?.decision.classification || record.workflowStatus}
                    </span>
                    <span>{result?.gates.urgency || "PENDING"} urgency</span>
                    <span>
                      {result?.routing.route.replaceAll("_", " ") ||
                        "Awaiting processing"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="lead-score">
                <strong>{result?.decision.score ?? "—"}</strong>
                <span>
                  {result?.decision.provisional ? "provisional" : "score"}
                </span>
              </div>
              <div className="lead-detail">
                <p>
                  <b>Problem</b>
                  {result?.analysis.problemSummary ||
                    record.lead.currentChallenge}
                </p>
                <p>
                  <b>Next action</b>
                  {result?.routing.recommendedAction || "Await orchestration."}
                </p>
                {result?.analysis.riskSignals.length ? (
                  <p className="risk">
                    <b>Risk evidence</b>
                    {result.analysis.riskSignals.join(" · ")}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

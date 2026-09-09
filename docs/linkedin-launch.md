# LinkedIn Featured Asset

**Title:** AI Lead Qualification & Follow-Up System

**Description:** A production-minded automation built with Next.js, Supabase, and n8n. It validates and persists leads, applies an explainable six-dimension score, handles duplicates and uncertainty, routes risk to humans, and schedules draft-only follow-up. Includes 10 scenario fixtures and 21 passing tests.

**Primary link:** https://ai-lead-qualification-follow-up-sys.vercel.app

**Supporting link:** https://github.com/MehtabRiaz/AI-Lead-Qualification-Follow-Up-System

# Build-in-public post

I stopped letting the LLM decide whether a sales lead was “good.”

Instead, I built a hybrid lead qualification system where deterministic rules own the decision and AI—when enabled—has one bounded job: interpret qualitative evidence.

The system:

- validates and persists every accepted lead before orchestration;
- prevents duplicate records and repeated follow-up;
- scores six explicit dimensions on a transparent 100-point rubric;
- keeps urgency and risk separate from opportunity quality;
- preserves missing information as unknown instead of converting it to zero;
- routes suspicious, incomplete, or high-risk cases to a human;
- retries temporary failures and recovers pending records every five minutes;
- creates auditable follow-up drafts without sending autonomous email.

The architecture uses Next.js on Vercel, Supabase PostgreSQL, and a 14-node n8n workflow with intake, recovery, and scheduled follow-up branches.

For verification, I built 10 realistic lead scenarios and 21 automated tests covering Hot, Warm, Low Fit, missing data, nurture, high risk, suspicious identity, and duplicate submissions.

The biggest lesson: a lead score measures opportunity quality. It should never be treated as permission to automate around validation, risk, or uncertainty.

Live demo: https://ai-lead-qualification-follow-up-sys.vercel.app

Source: https://github.com/MehtabRiaz/AI-Lead-Qualification-Follow-Up-System

# Suggested carousel outline

1. Why I stopped letting the LLM score leads
2. The problem with one opaque “AI score”
3. Five gates before normal routing
4. The six-dimension deterministic rubric
5. Persist-first architecture
6. Where the n8n Agent fits—and where it does not
7. Retry, recovery, and human-review design
8. Ten scenarios, 21 tests, one explainable system
9. Architecture and live demo

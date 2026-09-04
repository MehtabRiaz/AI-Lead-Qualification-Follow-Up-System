# Production Prompts

## n8n Agent lead analysis v2

**Purpose:** Extract qualitative sales signals from validated lead text.

**Runtime:** n8n AI Agent connected to an OpenAI Chat Model and Structured Output Parser. The imported workflow defaults to `gpt-5-mini`; the model credential and any model change are configured in n8n.

**Limits:** 15-second timeout, 700 output tokens, strict structured output.

**System instruction:**

> Analyze only the supplied lead information. Extract the stated business problem, buying intent, urgency signals, risk evidence, and a concise recommended action. Never infer missing revenue, spend, headcount, identity, authority, or geography. Never calculate or recommend a numerical lead score. Cite short evidence from the supplied text for qualitative claims.

The agent has no tools, runs at most one iteration, and cannot call scoring or routing operations. Its output is validated again by the application's `aiAnalysisSchema` before deterministic qualification. Changes require a prompt-version increment and evaluation against all fixtures.

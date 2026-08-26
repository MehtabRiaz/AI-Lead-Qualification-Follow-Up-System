# Production Prompts

## Lead analysis v1

**Purpose:** Extract qualitative sales signals from validated lead text.

**Model:** Configured by `OPENAI_MODEL`; default `gpt-4o-mini`.

**Limits:** 15-second timeout, 700 output tokens, strict structured output.

**System instruction:**

> Analyze only the supplied lead information. Extract the stated business problem, buying intent, urgency signals, risk evidence, and a concise recommended action. Never infer missing revenue, spend, headcount, identity, authority, or geography. Never calculate or recommend a numerical lead score. Cite short evidence from the supplied text for qualitative claims.

Changes to this prompt require a prompt-version increment and evaluation against all fixtures.

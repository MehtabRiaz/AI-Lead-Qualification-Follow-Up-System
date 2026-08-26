import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { leadInputSchema } from "@/domain/schemas";
import { getLeadService } from "@/services";
import {
  normalizeIdempotencyKey,
  publicReceipt,
} from "@/services/lead-service";
import { getEnv } from "@/lib/env";

async function notifyN8n(submissionId: string) {
  const env = getEnv();
  if (!env.N8N_WEBHOOK_URL) return false;
  const response = await fetch(env.N8N_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-n8n-secret": env.N8N_SHARED_SECRET,
    },
    body: JSON.stringify({ submissionId }),
    signal: AbortSignal.timeout(5_000),
  });
  return response.ok;
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const lead = leadInputSchema.parse(raw);
    const suppliedKey = request.headers.get("idempotency-key");
    const key = normalizeIdempotencyKey(suppliedKey, lead);
    const safeKey = createHash("sha256").update(key).digest("hex");
    const accepted = await getLeadService().acceptSubmission(lead, safeKey);

    if (!accepted.replay) {
      try {
        const notified = await notifyN8n(accepted.record.id);
        if (!notified && getEnv().DATA_MODE === "demo")
          await getLeadService().processSubmission(accepted.record.id);
      } catch {
        // Persistence already succeeded; the recovery workflow can process this later.
      }
    }

    return NextResponse.json(publicReceipt(accepted.record), {
      status: accepted.replay ? 200 : 202,
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          accepted: false,
          code: "INVALID_SUBMISSION",
          message: "Please check the submitted fields.",
        },
        { status: 400 },
      );
    return NextResponse.json(
      {
        accepted: false,
        code: "SUBMISSION_UNAVAILABLE",
        message: "We could not accept the request. Please try again.",
      },
      { status: 503 },
    );
  }
}

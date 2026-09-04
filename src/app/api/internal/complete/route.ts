import { NextResponse } from "next/server";
import { z } from "zod";
import { aiAnalysisSchema } from "@/domain/schemas";
import { getEnv } from "@/lib/env";
import { getLeadService } from "@/services";

const bodySchema = z
  .object({
    submissionId: z.string().min(1),
    aiAnalysis: aiAnalysisSchema.optional(),
    aiFailureReason: z.literal("AI_ANALYSIS_UNAVAILABLE").optional(),
  })
  .refine(
    (body) => Boolean(body.aiAnalysis) !== Boolean(body.aiFailureReason),
    "Exactly one AI outcome is required.",
  );

export async function POST(request: Request) {
  if (request.headers.get("x-n8n-secret") !== getEnv().N8N_SHARED_SECRET)
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const body = bodySchema.parse(await request.json());
  const record = await getLeadService().completeSubmission(
    body.submissionId,
    body.aiAnalysis
      ? { aiAnalysis: body.aiAnalysis }
      : { aiFailureReason: body.aiFailureReason! },
  );
  return NextResponse.json({
    submissionId: record.id,
    status: record.workflowStatus,
    result: record.result,
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getLeadService } from "@/services";

const bodySchema = z.object({ submissionId: z.string().min(1) });

export async function POST(request: Request) {
  if (request.headers.get("x-n8n-secret") !== getEnv().N8N_SHARED_SECRET)
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const { submissionId } = bodySchema.parse(await request.json());
  const prepared = await getLeadService().prepareSubmission(submissionId);
  if (prepared.analysisRequired) return NextResponse.json(prepared);
  const record = prepared.record;
  return NextResponse.json({
    analysisRequired: false,
    submissionId: record.id,
    status: record.workflowStatus,
    result: record.result,
  });
}

import { NextResponse } from "next/server";
import { getLeadRepository } from "@/data";
import { getEnv } from "@/lib/env";

export async function GET(request: Request) {
  if (request.headers.get("x-n8n-secret") !== getEnv().N8N_SHARED_SECRET)
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const records = await getLeadRepository().listPending(20);
  return NextResponse.json({
    submissions: records.map((record) => ({
      id: record.id,
      status: record.workflowStatus,
      attempts: record.attempts,
    })),
  });
}

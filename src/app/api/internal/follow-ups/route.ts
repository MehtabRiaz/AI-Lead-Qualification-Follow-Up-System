import { NextResponse } from "next/server";
import { getLeadRepository } from "@/data";
import { getEnv } from "@/lib/env";

export async function POST(request: Request) {
  if (request.headers.get("x-n8n-secret") !== getEnv().N8N_SHARED_SECRET)
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const processed = await getLeadRepository().processDueFollowUps(
    new Date().toISOString(),
    50,
  );
  return NextResponse.json({
    processed: processed.length,
    followUpIds: processed.map((item) => item.id),
    mode: "draft_only",
    message: "Due checkpoints were converted to drafts; no email was sent.",
  });
}

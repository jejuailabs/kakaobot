import { NextResponse, type NextRequest } from "next/server";
import { processJob } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Worker/Queue consumer·운영자 재시도용. 별도 service secret 필요 — 사용자 session 으로는 호출 불가. */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_JOB_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32 || auth !== `Bearer ${secret}`) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { jobId?: unknown } | null;
  if (!body || typeof body.jobId !== "string" || body.jobId.length > 300) return NextResponse.json({ error: { code: "validation" } }, { status: 400 });
  return NextResponse.json({ outcome: await processJob(body.jobId) });
}

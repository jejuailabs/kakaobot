import { NextResponse, type NextRequest } from "next/server";
import { cleanupExpired, sweepStaleJobs } from "@/lib/server/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron (vercel.json, 매일 03:00 KST). Vercel 이 Authorization: Bearer $CRON_SECRET 을 붙인다. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  }
  const removed = await cleanupExpired();
  const swept = await sweepStaleJobs(5);
  console.log("[cron] cleanup", { removed, swept });
  return NextResponse.json({ removed, swept });
}

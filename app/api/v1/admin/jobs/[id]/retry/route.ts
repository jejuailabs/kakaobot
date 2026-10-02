import { after } from "next/server";
import { retryJob } from "@/lib/server/admin-data";
import { adminRoute } from "@/lib/server/api";
import { processJob } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 실패 job 재시도 / 송신 불명(unknown) 건은 운영자 확인 후 명시적 재전송 — 감사 기록 */
export const POST = adminRoute<{ id: string }>(
  "jobs.manage",
  async ({ user, params }) => {
    const r = await retryJob(user, decodeURIComponent(params.id));
    if (r.kind === "job") {
      const jobId = r.jobId;
      after(async () => {
        await processJob(jobId);
      });
    }
    return { ok: true };
  },
  { mutation: true },
);

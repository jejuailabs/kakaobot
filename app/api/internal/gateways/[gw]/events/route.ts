import { after, NextResponse } from "next/server";
import { ingestEvent } from "@/lib/server/connection";
import { gatewayRoute } from "@/lib/server/gateway-route";
import { processJob } from "@/lib/server/runtime";
import { normalizedEventSchema } from "@/lib/shared/gateway-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/internal/gateways/:gw/events — 서명된 정규화 이벤트 수신.
 * 이벤트를 저장한 뒤에만 200 을 준다(실패 시 relay 가 같은 eventId 로 재시도).
 * AI 처리는 응답 후(after) 비동기로 수행한다. Cloudflare Queue 연결 전 MVP 구성이며,
 * 처리되지 못한 job 은 /api/internal/jobs/process 로 다시 처리할 수 있다.
 */
export const POST = gatewayRoute(async ({ gatewayId, body }) => {
  const parsed = normalizedEventSchema.safeParse(body);
  if (!parsed.success || parsed.data.gatewayId !== gatewayId) return NextResponse.json({ error: { code: "validation" } }, { status: 400 });
  const result = await ingestEvent(parsed.data);
  if (result.jobId) {
    const jobId = result.jobId;
    after(async () => {
      try {
        await processJob(jobId);
      } catch (e) {
        console.error("[events] processJob failed", { jobId, message: (e as Error).message?.slice(0, 200) });
      }
    });
  }
  return { outcome: result.outcome, reason: result.reason };
});

import { NextResponse } from "next/server";
import { ingestEvent } from "@/lib/server/connection";
import { gatewayRoute } from "@/lib/server/gateway-route";
import { normalizedEventSchema } from "@/lib/shared/gateway-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/gateways/:gw/events — 서명된 정규화 이벤트 수신.
 * 이벤트를 저장한 뒤에만 200 을 준다. 실패하면 relay 가 같은 eventId 로 재시도한다.
 * (Cloudflare Queue 연결 전 MVP: 저장 후 동기 처리. AI 호출은 jobs 에 넣어 S5 에서 비동기 처리)
 */
export const POST = gatewayRoute(async ({ gatewayId, body }) => {
  const parsed = normalizedEventSchema.safeParse(body);
  if (!parsed.success || parsed.data.gatewayId !== gatewayId) return NextResponse.json({ error: { code: "validation" } }, { status: 400 });
  return ingestEvent(parsed.data);
});

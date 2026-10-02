import { after } from "next/server";
import { gatewayRoute } from "@/lib/server/gateway-route";
import { sweepStaleJobs } from "@/lib/server/maintenance";
import { leaseOutbox } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST(서명) — 이 gateway 의 송신 대기 최대 10건을 lease 해서 돌려준다. */
export const maxDuration = 60;

export const POST = gatewayRoute(async ({ gatewayId }) => {
  const deliveries = await leaseOutbox(gatewayId);
  // relay 가 2초마다 부르므로, 멈춘 AI job 을 응답 후 소량씩 다시 처리한다
  after(async () => {
    try {
      await sweepStaleJobs(2);
    } catch (e) {
      console.error("[outbox] sweep failed", { message: (e as Error).message?.slice(0, 200) });
    }
  });
  return { deliveries };
});

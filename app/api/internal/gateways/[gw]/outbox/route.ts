import { gatewayRoute } from "@/lib/server/gateway-route";
import { leaseOutbox } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST(서명) — 이 gateway 의 송신 대기 최대 10건을 lease 해서 돌려준다. */
export const POST = gatewayRoute(async ({ gatewayId }) => ({ deliveries: await leaseOutbox(gatewayId) }));

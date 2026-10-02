import { NextResponse } from "next/server";
import { recordHeartbeat } from "@/lib/server/connection";
import { gatewayRoute } from "@/lib/server/gateway-route";
import { heartbeatSchema } from "@/lib/shared/gateway-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = gatewayRoute(async ({ gatewayId, body }) => {
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success || parsed.data.gatewayId !== gatewayId) return NextResponse.json({ error: { code: "validation" } }, { status: 400 });
  await recordHeartbeat(gatewayId, parsed.data.status, parsed.data.adapterVersion);
  return { ok: true };
});

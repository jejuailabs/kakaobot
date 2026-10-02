import { NextResponse } from "next/server";
import { gatewayRoute } from "@/lib/server/gateway-route";
import { ackDelivery } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST(서명) body: { deliveryId, result: "sent" | "failed" | "unknown", detail? } — unknown 은 자동 재전송하지 않는다. */
export const POST = gatewayRoute(async ({ gatewayId, body }) => {
  const b = body as { deliveryId?: unknown; result?: unknown; detail?: unknown };
  if (typeof b.deliveryId !== "string" || b.deliveryId.length > 400 || (b.result !== "sent" && b.result !== "failed" && b.result !== "unknown")) {
    return NextResponse.json({ error: { code: "validation" } }, { status: 400 });
  }
  await ackDelivery(gatewayId, b.deliveryId, b.result, typeof b.detail === "string" ? b.detail : undefined);
  return { ok: true };
});

import { NextResponse, type NextRequest } from "next/server";
import { gatewayRoute } from "@/lib/server/gateway-route";
import { ackDelivery } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** body: { result: "sent" | "failed" | "unknown", detail? } — unknown 은 자동 재전송하지 않는다. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ gw: string; id: string }> }) {
  const { id } = await ctx.params;
  const handler = gatewayRoute(async ({ gatewayId, body }) => {
    const b = body as { result?: unknown; detail?: unknown };
    if (b.result !== "sent" && b.result !== "failed" && b.result !== "unknown") return NextResponse.json({ error: { code: "validation" } }, { status: 400 });
    await ackDelivery(gatewayId, id, b.result, typeof b.detail === "string" ? b.detail : undefined);
    return { ok: true };
  });
  return handler(req, { params: ctx.params.then(({ gw }) => ({ gw })) });
}

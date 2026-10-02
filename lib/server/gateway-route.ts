import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { parseKeyring, SIG_HEADERS, verifySignature } from "@/lib/shared/gateway-contract";
import { consumeNonce } from "./connection";
import { requestId } from "./request-guard";

type GatewayHandler = (ctx: { gatewayId: string; body: unknown; req: NextRequest }) => Promise<unknown>;

/**
 * relay/Worker → web 내부 API. gateway 별 HMAC 키(GATEWAY_KEYRING), 5분 시간차, nonce 1회성.
 * 사용자 session 으로는 호출할 수 없다.
 */
export function gatewayRoute(handler: GatewayHandler) {
  return async (req: NextRequest, ctx: { params: Promise<{ gw: string }> }) => {
    const rid = requestId();
    const { gw } = await ctx.params;
    const secret = parseKeyring(process.env.GATEWAY_KEYRING)[gw];
    const raw = await req.text();
    if (!secret || req.headers.get(SIG_HEADERS.gateway) !== gw) return NextResponse.json({ error: { code: "unknown_gateway", requestId: rid } }, { status: 401 });
    const v = await verifySignature(secret, raw, {
      timestamp: req.headers.get(SIG_HEADERS.timestamp),
      nonce: req.headers.get(SIG_HEADERS.nonce),
      signature: req.headers.get(SIG_HEADERS.signature),
    });
    if (!v.ok) return NextResponse.json({ error: { code: v.reason, requestId: rid } }, { status: 401 });
    if (!(await consumeNonce(gw, req.headers.get(SIG_HEADERS.nonce)!))) return NextResponse.json({ error: { code: "replay", requestId: rid } }, { status: 409 });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: { code: "validation", requestId: rid } }, { status: 400 });
    }
    try {
      const result = await handler({ gatewayId: gw, body, req });
      return result instanceof NextResponse ? result : NextResponse.json(result ?? { ok: true });
    } catch (e) {
      console.error("[gateway] unexpected", { requestId: rid, gw, code: (e as { code?: unknown }).code, message: (e as Error).message?.slice(0, 200) });
      // relay 는 응답을 못 받으면 같은 eventId 로 재시도한다 → 5xx 로 알린다.
      return NextResponse.json({ error: { code: "internal", requestId: rid } }, { status: 500 });
    }
  };
}

import { z } from "zod";

// relay → ingress 정규화 이벤트 (프로젝트 내부 규격, docs/04). 원본 Iris payload 와 다르다.
// roomId / messageId 는 문자열 — JS number 로 바꾸지 않는다.
export const normalizedEventSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(3).max(200),
  gatewayId: z.string().regex(/^[a-z0-9-]{2,32}$/),
  roomId: z.string().regex(/^[0-9A-Za-z_-]{1,64}$/),
  senderId: z.string().min(1).max(128),
  messageId: z.string().min(1).max(128),
  text: z.string().max(8000),
  receivedAt: z.string().datetime(),
  isSelf: z.boolean(),
  kind: z.enum(["text", "system", "other"]),
});
export type NormalizedEvent = z.infer<typeof normalizedEventSchema>;

export const heartbeatSchema = z.object({
  gatewayId: z.string().regex(/^[a-z0-9-]{2,32}$/),
  status: z.enum(["ok", "degraded"]),
  adapterVersion: z.string().max(80),
  observedAt: z.string().datetime(),
});

// ── 서명: HMAC-SHA256(secret, `${timestamp}.${nonce}.${sha256(body)}`) ──
export const SIG_HEADERS = { gateway: "x-katcha-gateway", timestamp: "x-katcha-timestamp", nonce: "x-katcha-nonce", signature: "x-katcha-signature" } as const;
export const MAX_SKEW_MS = 5 * 60 * 1000;

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(data)));
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export async function signRequest(secret: string, body: string, timestamp = Date.now(), nonce = crypto.randomUUID()) {
  const signature = await hmacHex(secret, `${timestamp}.${nonce}.${await sha256Hex(body)}`);
  return { timestamp: String(timestamp), nonce, signature };
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "skew" | "bad_signature" };

/** nonce 재사용 검사는 호출 측(저장소)에서 한다. 여기서는 서명·시간차만 확인. */
export async function verifySignature(secret: string, body: string, h: { timestamp?: string | null; nonce?: string | null; signature?: string | null }, now = Date.now()): Promise<VerifyResult> {
  if (!h.timestamp || !h.nonce || !h.signature || !/^[0-9a-f]{64}$/.test(h.signature) || h.nonce.length > 64) return { ok: false, reason: "missing" };
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) return { ok: false, reason: "skew" };
  const expected = await hmacHex(secret, `${h.timestamp}.${h.nonce}.${await sha256Hex(body)}`);
  return timingSafeEqualHex(expected, h.signature) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/** GATEWAY_KEYRING = {"gw-01":"secret", ...} (gateway 별 별도 키, 회전 가능) */
export function parseKeyring(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].length >= 32));
  } catch {
    return {};
  }
}

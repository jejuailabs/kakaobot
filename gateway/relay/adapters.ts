// Iris 어댑터. 원본 Iris event payload 와 hook 방식은 설치한 release 에서 관찰해 맞춰야 한다 (docs/06).
// 여기서 확정된 것은 로컬 reply: POST {IRIS_BASE_URL}/reply {type:"text", room, data} 뿐이다.
import { createHash } from "node:crypto";
import type { NormalizedEvent } from "../../lib/shared/gateway-contract.ts";

export type SendResult = "sent" | "failed" | "unknown";

export interface ChatAdapter {
  readonly name: string;
  /** 원본 콜백 body → 정규화 이벤트 (자기 메시지 여부는 relay 가 판단) */
  normalize(raw: unknown, gatewayId: string): Omit<NormalizedEvent, "isSelf"> | null;
  send(roomId: string, text: string): Promise<SendResult>;
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" || typeof v === "bigint" ? String(v) : "");

/**
 * Iris (https://github.com/dolidolih/Iris) — ⚠ 미검증 매핑.
 * payload 필드명은 실제 release 에서 확인 후 고친다. 안정적인 native 메시지 ID 가 없으면
 * room/sender/timestamp/본문 hash 로 eventId 를 만든다 (충돌 가능성은 docs/08 에 기록).
 */
export function irisAdapter(baseUrl: string, timeoutMs = 8000): ChatAdapter {
  return {
    name: "iris",
    normalize(raw, gatewayId) {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const j = (typeof r.json === "object" && r.json ? r.json : {}) as Record<string, unknown>;
      const roomId = str(j.chat_id) || str(r.room_id) || str(r.chat_id);
      const text = str(r.msg) || str(j.message) || str(r.message);
      const senderId = str(j.user_id) || str(r.sender_id) || str(r.sender);
      const createdAt = Number(j.created_at ?? r.created_at ?? 0);
      if (!roomId || !senderId) return null;
      const nativeId = str(j._id) || str(j.id) || str(r.message_id);
      const messageId = nativeId || createHash("sha256").update(`${roomId}|${senderId}|${createdAt}|${text}`).digest("hex").slice(0, 32);
      return {
        schemaVersion: 1,
        eventId: `${gatewayId}:${messageId}`,
        gatewayId,
        roomId,
        senderId: createHash("sha256").update(`${gatewayId}:${senderId}`).digest("hex").slice(0, 32),
        messageId,
        text: text.slice(0, 8000),
        receivedAt: createdAt > 0 ? new Date(createdAt * (createdAt < 1e12 ? 1000 : 1)).toISOString() : new Date().toISOString(),
        kind: text ? "text" : "other",
      };
    },
    async send(roomId, text) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/reply`, { method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "text", room: roomId, data: text }) });
        return res.ok ? "sent" : "failed";
      } catch (e) {
        // timeout: 카톡에 전달됐는지 알 수 없다 → unknown (자동 재전송 금지)
        return (e as Error).name === "AbortError" ? "unknown" : "failed";
      } finally {
        clearTimeout(t);
      }
    },
  };
}

/** 로컬 검증용 mock: 보낸 메시지를 메모리에 기록. `failNext` 로 송신 불명 상황을 흉내낸다. */
export function mockAdapter(): ChatAdapter & { sent: { roomId: string; text: string }[]; failNext: SendResult | null } {
  const self = {
    name: "mock",
    sent: [] as { roomId: string; text: string }[],
    failNext: null as SendResult | null,
    normalize(raw: unknown, gatewayId: string) {
      const r = (raw ?? {}) as Record<string, unknown>;
      const roomId = str(r.room);
      if (!roomId) return null;
      const messageId = str(r.messageId) || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return { schemaVersion: 1 as const, eventId: `${gatewayId}:${messageId}`, gatewayId, roomId, senderId: str(r.sender) || "mock-user", messageId, text: str(r.text), receivedAt: new Date().toISOString(), kind: "text" as const };
    },
    async send(roomId: string, text: string): Promise<SendResult> {
      if (self.failNext) {
        const r = self.failNext;
        self.failNext = null;
        return r;
      }
      self.sent.push({ roomId, text });
      return "sent";
    },
  };
  return self;
}

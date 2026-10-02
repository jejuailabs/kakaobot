// mock gateway: 실제 relay 와 같은 계약(정규화 이벤트 + HMAC 서명)으로 web 에 이벤트를 보낸다.
// 카카오톡/Iris 없이 연결·호출 흐름을 검증하기 위한 도구다. 실운영 완료의 증거가 아니다.
//
// 사용 (Node 22.18+ type stripping):
//   node gateway/mock-gateway.ts send --room 1234567890 --text "!연결 ABCD-EFGH"
//   node gateway/mock-gateway.ts heartbeat
// 환경: MOCK_GATEWAY_ID(기본 gw-local), WEB_API_BASE_URL(기본 http://localhost:3000), GATEWAY_KEYRING(.env.local)
import "../scripts/env-local.mjs";
import { parseKeyring, SIG_HEADERS, signRequest, type NormalizedEvent } from "../lib/shared/gateway-contract.ts";

const gatewayId = process.env.MOCK_GATEWAY_ID ?? "gw-local";
const base = (process.env.WEB_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = parseKeyring(process.env.GATEWAY_KEYRING)[gatewayId];
if (!secret) {
  console.error(`GATEWAY_KEYRING 에 ${gatewayId} 키가 없습니다.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string, def = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? def) : def;
};

async function post(path: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const sig = await signRequest(secret, body);
  const res = await fetch(`${base}/api/internal/gateways/${gatewayId}/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [SIG_HEADERS.gateway]: gatewayId,
      [SIG_HEADERS.timestamp]: sig.timestamp,
      [SIG_HEADERS.nonce]: sig.nonce,
      [SIG_HEADERS.signature]: sig.signature,
    },
    body,
  });
  console.log(res.status, await res.text());
}

if (cmd === "send") {
  const messageId = opt("message-id", `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const ev: NormalizedEvent = {
    schemaVersion: 1,
    eventId: `${gatewayId}:${messageId}`,
    gatewayId,
    roomId: opt("room", "1000000000000000001"),
    senderId: opt("sender", "mock-sender-1"),
    messageId,
    text: opt("text", "!AI 안녕"),
    receivedAt: new Date().toISOString(),
    isSelf: args.includes("--self"),
    kind: "text",
  };
  await post("events", ev);
} else if (cmd === "heartbeat") {
  await post("heartbeat", { gatewayId, status: "ok", adapterVersion: "mock-0.1.0", observedAt: new Date().toISOString() });
} else {
  console.log('사용: node gateway/mock-gateway.ts send --room <id> --text "<msg>" [--message-id <id>] [--self] | heartbeat');
}

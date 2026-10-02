// Katcha Oracle relay — 상시 프로세스 (docs/06).
// Iris 콜백(localhost) → SQLite inbox → 서명 → web ingress / outbox poll(2초) → journal → Iris /reply → ack / heartbeat(30초).
// Iris API·adb 는 외부에 공개하지 않는다. relay 의 콜백 서버도 127.0.0.1 에만 bind 한다.
//
// 실행: node --no-warnings gateway/relay/relay.ts
// 환경: GATEWAY_ID, GATEWAY_SIGNING_KEY, WEB_API_BASE_URL, IRIS_BASE_URL(기본 http://127.0.0.1:3000),
//       RELAY_ADAPTER(iris|mock, 기본 iris), RELAY_LISTEN_PORT(기본 8790), SQLITE_PATH(기본 ./relay.db),
//       SELF_SENDER_ID(봇 계정 원본 user id, 선택), OUTBOX_MAX_AGE_MIN(기본 10)
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SIG_HEADERS, signRequest } from "../../lib/shared/gateway-contract.ts";
import { irisAdapter, mockAdapter, type ChatAdapter } from "./adapters.ts";
import { RelayStore } from "./store.ts";

type Config = {
  gatewayId: string;
  signingKey: string;
  webBase: string;
  irisBase: string;
  adapter: "iris" | "mock";
  port: number;
  sqlitePath: string;
  selfSenderId: string;
  outboxMaxAgeMs: number;
  adapterVersion: string;
};

export function loadConfig(env = process.env): Config {
  const need = (k: string) => {
    const v = env[k];
    if (!v) throw new Error(`환경변수 ${k} 가 필요합니다`);
    return v;
  };
  return {
    gatewayId: need("GATEWAY_ID"),
    signingKey: need("GATEWAY_SIGNING_KEY"),
    webBase: need("WEB_API_BASE_URL").replace(/\/$/, ""),
    irisBase: env.IRIS_BASE_URL ?? "http://127.0.0.1:3000",
    adapter: env.RELAY_ADAPTER === "mock" ? "mock" : "iris",
    port: Number(env.RELAY_LISTEN_PORT ?? 8790),
    sqlitePath: env.SQLITE_PATH ?? "./relay.db",
    selfSenderId: env.SELF_SENDER_ID ?? "",
    outboxMaxAgeMs: Number(env.OUTBOX_MAX_AGE_MIN ?? 10) * 60_000,
    adapterVersion: `relay-0.1.0/${env.RELAY_ADAPTER === "mock" ? "mock" : "iris-unverified"}`,
  };
}

const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

export function createRelay(cfg: Config, adapter: ChatAdapter = cfg.adapter === "mock" ? mockAdapter() : irisAdapter(cfg.irisBase)) {
  const store = new RelayStore(cfg.sqlitePath);
  const timers: NodeJS.Timeout[] = [];
  let flushing = false;
  let polling = false;

  async function signedPost(path: string, payload: unknown) {
    const body = JSON.stringify(payload);
    const sig = await signRequest(cfg.signingKey, body);
    return fetch(`${cfg.webBase}/api/internal/gateways/${cfg.gatewayId}/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SIG_HEADERS.gateway]: cfg.gatewayId,
        [SIG_HEADERS.timestamp]: sig.timestamp,
        [SIG_HEADERS.nonce]: sig.nonce,
        [SIG_HEADERS.signature]: sig.signature,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
  }

  /** Iris 콜백 수신: 정규화 → self 판별 → inbox 에 먼저 기록 */
  function accept(raw: unknown): { stored: boolean; eventId?: string } {
    const ev = adapter.normalize(raw, cfg.gatewayId);
    if (!ev) return { stored: false };
    const rawSender = typeof raw === "object" && raw ? String((raw as Record<string, unknown>).sender ?? "") : "";
    const isSelf = Boolean(cfg.selfSenderId && rawSender === cfg.selfSenderId) || store.recentlySent(ev.roomId, hash(ev.text));
    const stored = store.enqueue(ev.eventId, { ...ev, isSelf });
    return { stored, eventId: ev.eventId };
  }

  async function flushInbox() {
    if (flushing) return;
    flushing = true;
    try {
      for (const row of store.due()) {
        try {
          const res = await signedPost("events", JSON.parse(row.payload));
          if (res.ok) store.markSent(row.event_id);
          else if (res.status >= 400 && res.status < 500 && res.status !== 409 && res.status !== 429) store.markDead(row.event_id, `HTTP ${res.status} ${await res.text()}`);
          else store.markRetry(row.event_id, row.attempts, `HTTP ${res.status}`);
        } catch (e) {
          store.markRetry(row.event_id, row.attempts, (e as Error).message);
        }
      }
    } finally {
      flushing = false;
    }
  }

  async function ack(deliveryId: string, result: "sent" | "failed" | "unknown", detail?: string) {
    try {
      const res = await signedPost("ack", { deliveryId, result, detail });
      if (res.ok) store.journalAcked(deliveryId);
    } catch {
      /* 다음 poll 주기에 unackedResults 로 다시 보낸다 */
    }
  }

  async function pollOutbox() {
    if (polling) return;
    polling = true;
    try {
      // 이전에 ack 못 한 결과부터 보고
      for (const r of store.unackedResults()) await ack(r.delivery_id, r.state === "sending" ? "unknown" : r.state);
      const res = await signedPost("outbox", {});
      if (!res.ok) return;
      const { deliveries } = (await res.json()) as { deliveries: { id: string; roomId: string; text: string; createdAt: string }[] };
      for (const d of deliveries) {
        // 복구·재시작 후 오래된 송신은 보내지 않는다 (cutoff)
        if (Date.now() - new Date(d.createdAt).getTime() > cfg.outboxMaxAgeMs) {
          await ack(d.id, "failed", "stale");
          continue;
        }
        if (!store.journalBegin(d.id, d.roomId, hash(d.text))) continue; // 이미 기록된 건은 재전송하지 않음
        const result = await adapter.send(d.roomId, d.text);
        store.journalSet(d.id, result);
        log("send", { delivery: d.id, room: d.roomId, result });
        await ack(d.id, result);
      }
    } catch (e) {
      log("outbox poll error", { error: (e as Error).message });
    } finally {
      polling = false;
    }
  }

  async function heartbeat() {
    try {
      const s = store.stats();
      await signedPost("heartbeat", { gatewayId: cfg.gatewayId, status: s.inboxPending > 50 ? "degraded" : "ok", adapterVersion: cfg.adapterVersion, observedAt: new Date().toISOString() });
    } catch (e) {
      log("heartbeat error", { error: (e as Error).message });
    }
  }

  async function readBody(req: IncomingMessage) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 256 * 1024) throw new Error("too large");
      chunks.push(c as Buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === "POST" && (req.url === "/iris" || req.url === "/mock/event")) {
        const raw = JSON.parse(await readBody(req));
        const r = accept(raw);
        void flushInbox();
        return reply(r.eventId ? 200 : 400, r);
      }
      if (req.method === "GET" && req.url === "/health") return reply(200, { gatewayId: cfg.gatewayId, adapter: adapter.name, ...store.stats() });
      if (req.method === "GET" && req.url === "/mock/sent" && "sent" in adapter) return reply(200, { sent: (adapter as ReturnType<typeof mockAdapter>).sent });
      if (req.method === "POST" && req.url === "/mock/fail-next" && "failNext" in adapter) {
        (adapter as ReturnType<typeof mockAdapter>).failNext = JSON.parse(await readBody(req)).result;
        return reply(200, { ok: true });
      }
      reply(404, { error: "not found" });
    } catch (e) {
      reply(400, { error: (e as Error).message });
    }
  });

  return {
    store,
    adapter,
    async start() {
      const recovered = store.recoverInterruptedSends();
      if (recovered.length) log("recovered interrupted sends as unknown (not resent)", { count: recovered.length });
      await new Promise<void>((r) => server.listen(cfg.port, "127.0.0.1", () => r()));
      timers.push(setInterval(() => void flushInbox(), 1000), setInterval(() => void pollOutbox(), 2000), setInterval(() => void heartbeat(), 30_000));
      void heartbeat();
      log("relay started", { gatewayId: cfg.gatewayId, adapter: adapter.name, port: cfg.port });
    },
    async stop() {
      timers.forEach(clearInterval);
      await new Promise<void>((r) => server.close(() => r()));
      store.close();
    },
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1:")}` || process.argv[1]?.endsWith("relay.ts")) {
  const relay = createRelay(loadConfig());
  await relay.start();
  const shutdown = async () => {
    await relay.stop();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

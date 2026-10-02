// relay 프로세스 E2E (mock 어댑터, 실제 web + Firestore + gpt-6-luna). 실제 카카오톡 검증이 아니다.
// 실행: npm run e2e:relay   (E2E_BASE_URL 기본 http://localhost:3000)
import "./env-local.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KEY = JSON.parse(process.env.GATEWAY_KEYRING ?? "{}")["gw-local"];
const raw = process.env.FIREBASE_ADMIN_CREDENTIALS ?? "";
const app = initializeApp({ credential: cert(JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString())) });
const auth = getAuth(app);
const db = getFirestore(app);
db.settings({ preferRest: true });

const run = Date.now().toString(36);
const uid = `e2e-relay-${run}`;
const ws = `ws_${uid}`;
const room = `88${Date.now()}`;
const PORT = 8791;
const dir = mkdtempSync(path.join(tmpdir(), "katcha-relay-"));
const sqlite = path.join(dir, "relay.db");
let failures = 0;
const step = (n, ok, info = "") => {
  if (!ok) failures++;
  console.log(ok ? "OK " : "ERR", n, info);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startRelay(webBase) {
  const p = spawn(process.execPath, ["--no-warnings", "gateway/relay/relay.ts"], {
    env: { ...process.env, GATEWAY_ID: "gw-local", GATEWAY_SIGNING_KEY: KEY, WEB_API_BASE_URL: webBase, RELAY_ADAPTER: "mock", RELAY_LISTEN_PORT: String(PORT), SQLITE_PATH: sqlite },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("relay start timeout")), 15000);
    p.stdout.on("data", (b) => b.toString().includes("relay started") && (clearTimeout(t), resolve(p)));
    p.on("exit", (c) => reject(new Error(`relay exited ${c}`)));
  });
}
const stopRelay = (p) => new Promise((r) => (p.once("exit", () => r()), p.kill("SIGTERM"), setTimeout(() => (p.kill("SIGKILL"), r()), 3000)));
const relay = (method, p, body) => fetch(`http://127.0.0.1:${PORT}${p}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

await auth.createUser({ uid, email: `${uid}@katcha.test` }).catch(() => {});
await auth.setCustomUserClaims(uid, { roles: ["superadmin"] });
const { idToken } = await (
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: await auth.createCustomToken(uid), returnSecureToken: true }) })
).json();
const session = await auth.createSessionCookie(idToken, { expiresIn: 3600_000 });
const csrf = "e2e0123456789abcdef0123456789abcdef";
const api = async (m, p, b, extra = {}) => {
  const r = await fetch(BASE + p, { method: m, headers: { origin: BASE, "content-type": "application/json", cookie: `katcha_session=${session}; katcha_csrf=${csrf}`, "x-katcha-csrf": csrf, ...extra }, body: b ? JSON.stringify(b) : undefined });
  return [r.status, await r.json().catch(() => null)];
};

let proc;
try {
  const bot = { name: "Relay 테스트봇", description: "", roomUrl: "", locale: "ko", timezone: "Asia/Seoul", roles: ["qa"], faq: "", customPrompt: "", trigger: "!AI", tone: "concise", length: "short", replyLocale: "ko", modelId: "default", dailyLimit: 100 };
  const [, c] = await api("POST", "/api/v1/bots", bot, { "idempotency-key": `relay-${run}` });
  const id = c.bot.id;
  await api("POST", `/api/v1/bots/${id}/join-request`, { url: "", roomLabel: "Relay 방", permissionConfirmed: true, noticeConfirmed: true });
  await api("POST", `/api/v1/admin/join-requests/${id}`, { decision: "joined", reason: "relay e2e" });
  const [, t] = await api("POST", `/api/v1/bots/${id}/pairing-token`);
  const code = t.pairingCode.code;

  // 1) web 이 내려가 있을 때 받은 이벤트는 SQLite 에 남는다
  proc = await startRelay("http://127.0.0.1:9");
  const acc = await relay("POST", "/mock/event", { room, text: `!연결 ${code}`, messageId: `m-${run}-1` });
  await sleep(2500);
  let h = await relay("GET", "/health");
  step("event kept in SQLite inbox while web is unreachable", acc.stored && h.inboxPending === 1, JSON.stringify(h));
  await stopRelay(proc);

  // 2) 재시작 후 같은 eventId 로 전달 → 연결
  proc = await startRelay(BASE);
  for (let i = 0; i < 20; i++) {
    h = await relay("GET", "/health");
    if (h.inboxPending === 0) break;
    await sleep(1000);
  }
  const [, b1] = await api("GET", `/api/v1/bots/${id}`);
  step("after restart the stored event is delivered and room connects", h.inboxPending === 0 && b1.bot.state === "active", b1.bot.state);
  const dupe = await relay("POST", "/mock/event", { room, text: `!연결 ${code}`, messageId: `m-${run}-1` });
  step("duplicate Iris callback is not stored twice", dupe.stored === false);

  // 3) 질문 → 실제 AI 답변이 mock 카톡으로 송신되고 ack
  await relay("POST", "/mock/event", { room, text: "!AI 한 문장으로 인사해 줘", messageId: `m-${run}-2` });
  let sent = [];
  for (let i = 0; i < 25 && sent.length < 2; i++) {
    await sleep(2000);
    sent = (await relay("GET", "/mock/sent")).sent.filter((x) => x.roomId === room);
  }
  step("connect notice sent to room", sent.some((x) => x.text.includes("연결")), sent[0]?.text);
  const answer = sent.find((x) => !x.text.includes("연결됐어요"));
  step("real AI answer sent to room via relay", Boolean(answer && /[가-힣]/.test(answer.text)), answer?.text?.slice(0, 60));
  await sleep(2500);
  const sentDeliveries = await db.collection("deliveries").where("workspaceId", "==", ws).where("state", "==", "sent").get();
  step("deliveries acked as sent", sentDeliveries.size >= 2, sentDeliveries.size);

  // 4) 봇이 보낸 문장이 다시 콜백으로 들어오면 self 로 무시
  if (answer) {
    await relay("POST", "/mock/event", { room, text: answer.text, messageId: `m-${run}-echo`, sender: "bot-account" });
    await sleep(3000);
    const ev = await db.collection("events").doc(encodeURIComponent(`gw-local:m-${run}-echo`)).get();
    step("bot's own echoed message ignored as self", ev.data()?.outcome === "ignored_self", ev.data()?.outcome);
  }

  // 5) 송신 결과 불명(timeout) → unknown 으로 보고, 재전송하지 않음
  await relay("POST", "/mock/fail-next", { result: "unknown" });
  await relay("POST", "/mock/event", { room, text: "!AI 숫자 하나만 말해 줘", messageId: `m-${run}-3` });
  let unknown = null;
  for (let i = 0; i < 25 && !unknown; i++) {
    await sleep(2000);
    const q = await db.collection("deliveries").where("workspaceId", "==", ws).where("state", "==", "unknown").get();
    unknown = q.docs[0] ?? null;
  }
  step("timed-out send reported as unknown", Boolean(unknown));
  const before = (await relay("GET", "/mock/sent")).sent.length;
  await sleep(8000);
  const after = (await relay("GET", "/mock/sent")).sent.length;
  step("unknown delivery is not resent automatically", after === before, `${before} -> ${after}`);
} catch (e) {
  failures++;
  console.log("ERR exception", e.message);
} finally {
  if (proc) await stopRelay(proc);
  for (const c of ["bots", "promptVersions", "activities", "idempotencyKeys", "joinRequests", "pairingTokens", "roomBindings", "deliveries", "jobs", "auditLogs", "conversationLogs", "usageDaily", "usageMonthly", "botUsageDaily"]) {
    const snap = await db.collection(c).where("workspaceId", "==", ws).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const ev = await db.collection("events").where("roomId", "==", room).get();
  await Promise.all(ev.docs.map((d) => d.ref.delete()));
  for (const prefix of [`ws__${ws}__`, `room__gw-local__${room}__`]) {
    const rc = await db.collection("rateCounters").where("__name__", ">=", prefix).where("__name__", "<", `${prefix}~`).get();
    await Promise.all(rc.docs.map((d) => d.ref.delete()));
  }
  await Promise.all([db.doc(`users/${uid}`).delete(), db.doc(`workspaces/${ws}`).delete(), db.doc(`pairingAttempts/gw-local__${room}`).delete()]);
  await auth.deleteUser(uid).catch(() => {});
  rmSync(dir, { recursive: true, force: true });
  console.log("cleanup done");
}
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

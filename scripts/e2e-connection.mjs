// 연결 흐름 HTTP E2E (mock gateway 사용). 실제 카카오톡 검증이 아니다.
// 테스트 운영자 계정을 만들고 → 챗봇 생성 → 입장요청 → 운영자 승인 → 코드 발급 → 서명된 mock 이벤트로 연결 → 호출어 job 확인
// 끝나면 계정·데이터를 모두 지운다.
// 실행: npm run e2e:connection   (E2E_BASE_URL 기본 http://localhost:3000, GATEWAY_KEYRING 의 gw-local 키 필요)
import "./env-local.mjs";
import { execFileSync } from "node:child_process";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const raw = process.env.FIREBASE_ADMIN_CREDENTIALS ?? "";
const app = initializeApp({ credential: cert(JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString())) });
const auth = getAuth(app);
const db = getFirestore(app);
db.settings({ preferRest: true });

const uid = "e2e-connection-operator";
const ws = `ws_${uid}`;
let failures = 0;
const step = (name, ok, info = "") => {
  if (!ok) failures++;
  console.log(ok ? "OK " : "ERR", name, info);
};

await auth.createUser({ uid, email: "e2e-connection@katcha.test", displayName: "E2E" }).catch(() => {});
await auth.setCustomUserClaims(uid, { roles: ["superadmin"] });
const custom = await auth.createCustomToken(uid);
const { idToken } = await (
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  })
).json();
const session = await auth.createSessionCookie(idToken, { expiresIn: 3600_000 });
const csrf = "e2e0123456789abcdef0123456789abcdef";
const H = { origin: BASE, "content-type": "application/json", cookie: `katcha_session=${session}; katcha_csrf=${csrf}`, "x-katcha-csrf": csrf };
const api = async (method, path, body, extra = {}) => {
  const r = await fetch(BASE + path, { method, headers: { ...H, ...extra }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const room = `77${Date.now()}`;
const mock = (text) =>
  execFileSync(process.execPath, ["gateway/mock-gateway.ts", "send", "--room", room, "--text", text], {
    env: { ...process.env, WEB_API_BASE_URL: BASE },
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();

try {
  const bot = { name: "E2E 연결봇", description: "", roomUrl: "", locale: "ko", timezone: "Asia/Seoul", roles: ["qa"], faq: "", customPrompt: "", trigger: "!AI", tone: "friendly", length: "normal", replyLocale: "ko", modelId: "default", dailyLimit: 100 };
  let [s, j] = await api("POST", "/api/v1/bots", bot, { "idempotency-key": `e2e-${Date.now()}` });
  step("create bot", s === 200, s);
  const id = j.bot.id;
  [s, j] = await api("POST", `/api/v1/bots/${id}/pairing-token`);
  step("code before operator approval is rejected", s === 409, `${s} ${j?.error?.code}`);
  [s] = await api("POST", `/api/v1/bots/${id}/join-request`, { url: "", roomLabel: "E2E 방", permissionConfirmed: true, noticeConfirmed: true });
  step("join request", s === 200, s);
  [s, j] = await api("GET", "/api/v1/admin/join-requests");
  step("operator queue lists it", s === 200 && j.requests.some((r) => r.id === id), s);
  [s] = await api("POST", `/api/v1/admin/join-requests/${id}`, { decision: "joined", reason: "E2E 테스트 승인" });
  step("operator marks joined", s === 200, s);
  [s, j] = await api("POST", `/api/v1/bots/${id}/pairing-token`);
  const code = j?.pairingCode?.code;
  step("issue code", s === 200 && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code ?? ""), s);
  let out = mock(`!연결 ${code}`);
  step("room posts code via signed mock gateway", out.includes('"outcome":"connected"'), out);
  [s, j] = await api("GET", `/api/v1/bots/${id}`);
  step("bot is active with room label", j?.bot?.state === "active" && j?.bot?.roomLabel === "E2E 방", j?.bot?.state);
  out = mock(`!연결 ${code}`);
  step("reused code is rejected", out.includes("connect_rejected"), out);
  out = mock("!AI 오늘 일정 알려줘");
  step("trigger message queued as one AI job", out.includes('"outcome":"queued"'), out);
  out = mock("그냥 잡담");
  step("normal chat ignored", out.includes("ignored_no_trigger"), out);
  const deliveries = await db.collection("deliveries").where("workspaceId", "==", ws).get();
  step("connect notice queued in outbox", deliveries.size === 1, deliveries.size);
  const r = await fetch(`${BASE}/api/internal/gateways/gw-local/events`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-katcha-gateway": "gw-local", "x-katcha-timestamp": String(Date.now()), "x-katcha-nonce": "n1", "x-katcha-signature": "0".repeat(64) },
    body: "{}",
  });
  step("forged gateway signature rejected", r.status === 401, r.status);
} finally {
  for (const c of ["bots", "promptVersions", "activities", "idempotencyKeys", "joinRequests", "pairingTokens", "roomBindings", "deliveries", "jobs", "auditLogs", "wizardDrafts"]) {
    const snap = await db.collection(c).where("workspaceId", "==", ws).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const ev = await db.collection("events").where("roomId", "==", room).get();
  await Promise.all(ev.docs.map((d) => d.ref.delete()));
  await Promise.all([db.doc(`users/${uid}`).delete(), db.doc(`workspaces/${ws}`).delete(), db.doc(`pairingAttempts/gw-local__${room}`).delete()]);
  await auth.deleteUser(uid).catch(() => {});
  console.log("cleanup done");
}
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

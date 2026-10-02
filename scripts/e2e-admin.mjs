// 운영자 RBAC·회원 정지·원문 열람·감사·CSV HTTP E2E. 테스트 계정·데이터는 끝나면 모두 지운다.
// 실행: npm run e2e:admin   (E2E_BASE_URL 기본 http://localhost:3000)
import "./env-local.mjs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const raw = process.env.FIREBASE_ADMIN_CREDENTIALS ?? "";
const app = initializeApp({ credential: cert(JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString())) });
const auth = getAuth(app);
const db = getFirestore(app);
db.settings({ preferRest: true });

const run = Date.now().toString(36);
const users = {
  admin: { uid: `e2e-adm-super-${run}`, roles: ["superadmin"] },
  analyst: { uid: `e2e-adm-analyst-${run}`, roles: ["analyst"] },
  designer: { uid: `e2e-adm-designer-${run}`, roles: ["designer"] },
  customer: { uid: `e2e-adm-customer-${run}`, roles: [] },
};
let failures = 0;
const step = (name, ok, info = "") => {
  if (!ok) failures++;
  console.log(ok ? "OK " : "ERR", name, info);
};
const csrf = "e2e0123456789abcdef0123456789abcdef";

async function sessionFor(u) {
  await auth.createUser({ uid: u.uid, email: `${u.uid}@katcha.test`, displayName: u.uid }).catch(() => {});
  await auth.setCustomUserClaims(u.uid, { roles: u.roles });
  const { idToken } = await (
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: await auth.createCustomToken(u.uid), returnSecureToken: true }),
    })
  ).json();
  return auth.createSessionCookie(idToken, { expiresIn: 3600_000 });
}
const call = async (session, method, path, body) => {
  const r = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: { origin: BASE, "content-type": "application/json", cookie: `katcha_session=${session}; katcha_csrf=${csrf}`, "x-katcha-csrf": csrf },
    body: body ? JSON.stringify(body) : undefined,
  });
  return [r.status, await r.text()];
};

const s = {};
const logId = `e2e-log-${run}`;
try {
  for (const [k, u] of Object.entries(users)) s[k] = await sessionFor(u);
  // 고객 users/workspace 문서 + 대화 로그 1건 (원문에 전화번호·수식 시작 문자)
  const ws = `ws_${users.customer.uid}`;
  await db.doc(`users/${users.customer.uid}`).set({ uid: users.customer.uid, email: `${users.customer.uid}@katcha.test`, displayName: "E2E 고객", status: "active", workspaceId: ws, createdAt: FieldValue.serverTimestamp(), lastLoginAt: FieldValue.serverTimestamp() });
  await db.doc(`workspaces/${ws}`).set({ id: ws, ownerUid: users.customer.uid, status: "active", limits: { maxBots: 3, workspaceDaily: 100 } });
  await db.doc(`conversationLogs/${logId}`).set({ workspaceId: ws, botId: "b1", roomId: "r1", gatewayId: "gw-local", threadKey: "t", input: "=HYPERLINK(1) 010-1234-5678 로 연락", output: "알겠어요", model: "gpt-6-luna", status: "answered", latencyMs: 1200, inputTokens: 10, outputTokens: 5, costMicros: 3, promptVersion: 1, requestId: logId, createdAt: FieldValue.serverTimestamp() });

  // 화면 접근
  let [st] = await call(s.admin, "GET", "/ko/admin");
  step("superadmin: /admin 200", st === 200, st);
  for (const p of ["/ko/admin/members", "/ko/admin/conversations", "/ko/admin/audit", "/ko/admin/jobs", "/ko/admin/gateways"]) {
    [st] = await call(s.admin, "GET", p);
    step(`superadmin: ${p} 200`, st === 200, st);
  }
  [st] = await call(s.customer, "GET", "/ko/admin");
  step("customer: /admin 404", st === 404, st);
  [st] = await call(s.designer, "GET", "/ko/admin/conversations");
  step("designer: conversation logs 404", st === 404, st);
  [st] = await call(s.analyst, "GET", "/ko/admin");
  step("analyst: metrics 200", st === 200, st);
  [st] = await call(s.analyst, "GET", "/ko/admin/members");
  step("analyst: members 404", st === 404, st);

  // 목록 HTML 에 원문이 그대로 내려가지 않는다 (마스킹)
  let [, html] = await call(s.admin, "GET", "/ko/admin/conversations");
  step("conversation list is masked in HTML", !html.includes("010-1234-5678") && html.includes("010-****-5678"));

  // 원문 열람
  [st] = await call(s.analyst, "POST", `/api/v1/admin/conversations/${logId}/reveal`, { reason: "분석 목적" });
  step("analyst cannot reveal raw text (404)", st === 404, st);
  [st] = await call(s.admin, "POST", `/api/v1/admin/conversations/${logId}/reveal`, { reason: "" });
  step("reveal without reason rejected (400)", st === 400, st);
  let body;
  [st, body] = await call(s.admin, "POST", `/api/v1/admin/conversations/${logId}/reveal`, { reason: "E2E 고객 문의 확인" });
  step("superadmin reveal with reason returns raw", st === 200 && body.includes("010-1234-5678"), st);
  const audits = await db.collection("auditLogs").where("actorUid", "==", users.admin.uid).get();
  step("reveal is audited", audits.docs.some((d) => d.data().action === "conversation.reveal" && d.data().targetId === logId));

  // CSV
  [st, body] = await call(s.admin, "POST", "/api/v1/admin/conversations/export", { days: 1, reason: "E2E 내보내기" });
  step("CSV export masked + formula neutralized", st === 200 && body.includes("'=HYPERLINK") && !body.includes("010-1234-5678"), st);
  [st] = await call(s.analyst, "POST", "/api/v1/admin/conversations/export", { days: 1, reason: "E2E" });
  step("analyst cannot export (404)", st === 404, st);

  // 한도·정지
  [st] = await call(s.admin, "PATCH", `/api/v1/admin/members/${users.customer.uid}`, { action: "limit", dailyLimit: 50, reason: "E2E 한도" });
  const wsDoc = (await db.doc(`workspaces/${ws}`).get()).data();
  step("limit change applied", st === 200 && wsDoc.limits.workspaceDaily === 50, st);
  [st] = await call(s.customer, "GET", "/api/v1/bots");
  step("customer API works before suspension", st === 200, st);
  [st] = await call(s.admin, "PATCH", `/api/v1/admin/members/${users.customer.uid}`, { action: "status", status: "suspended", reason: "E2E 정지 테스트" });
  step("superadmin suspends member", st === 200, st);
  [st] = await call(s.customer, "GET", "/api/v1/bots");
  step("suspended member's existing session is rejected", st === 401 || st === 403, st);
  [st] = await call(s.analyst, "PATCH", `/api/v1/admin/members/${users.customer.uid}`, { action: "status", status: "active", reason: "권한 없는 시도" });
  step("analyst cannot change member status (404)", st === 404, st);
  const audit2 = await db.collection("auditLogs").where("actorUid", "==", users.admin.uid).get();
  step("suspend + limit audited", ["member.suspend", "member.limit"].every((a) => audit2.docs.some((d) => d.data().action === a)));

  // 배경 관리 (적용은 운영 배경을 바꾸므로 여기서 하지 않음 — tests/integration/appearance.test.ts 가 분리된 문서로 검증)
  [st] = await call(s.designer, "GET", "/ko/admin/appearance");
  step("designer: appearance 200", st === 200, st);
  [st] = await call(s.analyst, "GET", "/ko/admin/appearance");
  step("analyst: appearance 404", st === 404, st);
  const sharp = (await import("sharp")).default;
  const jpg = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: { r: 30, g: 80, b: 120 } } }).jpeg().toBuffer();
  const form = new FormData();
  form.set("file", new Blob([jpg], { type: "image/jpeg" }), "e2e.jpg");
  form.set("theme", "dark");
  form.set("label", "e2e upload");
  let r = await fetch(`${BASE}/api/v1/admin/appearance/uploads`, { method: "POST", headers: { origin: BASE, cookie: `katcha_session=${s.designer}; katcha_csrf=${csrf}`, "x-katcha-csrf": csrf }, body: form });
  const up = await r.json().catch(() => null);
  step("designer uploads background (draft)", r.status === 200 && Boolean(up?.asset?.id), r.status);
  if (up?.asset?.id) {
    r = await fetch(`${BASE}/api/v1/appearance/files/${up.asset.id}/desktop`);
    step("draft image hidden from anonymous (404)", r.status === 404, r.status);
    r = await fetch(`${BASE}/api/v1/appearance/files/${up.asset.id}/thumb`, { headers: { cookie: `katcha_session=${s.designer}` } });
    step("designer can preview draft", r.status === 200 && r.headers.get("content-type") === "image/webp", r.status);
    [st] = await call(s.designer, "DELETE", `/api/v1/admin/appearance/assets/${up.asset.id}`);
    step("designer deletes unused draft", st === 200, st);
  }
  const svgForm = new FormData();
  svgForm.set("file", new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: "image/jpeg" }), "fake.jpg");
  svgForm.set("theme", "dark");
  r = await fetch(`${BASE}/api/v1/admin/appearance/uploads`, { method: "POST", headers: { origin: BASE, cookie: `katcha_session=${s.designer}; katcha_csrf=${csrf}`, "x-katcha-csrf": csrf }, body: svgForm });
  step("SVG disguised as JPEG rejected (415)", r.status === 415, r.status);
  [st] = await call(s.designer, "POST", "/api/v1/admin/appearance/generate", {});
  step("AI generation reports not configured (503)", st === 503, st);
} finally {
  const wsIds = Object.values(users).map((u) => `ws_${u.uid}`);
  for (const id of Object.values(users).map((u) => u.uid)) {
    const a = await db.collection("auditLogs").where("actorUid", "==", id).get();
    await Promise.all(a.docs.map((d) => d.ref.delete()));
    await db.doc(`users/${id}`).delete();
    await auth.deleteUser(id).catch(() => {});
  }
  for (const w of wsIds) await db.doc(`workspaces/${w}`).delete();
  await db.doc(`conversationLogs/${logId}`).delete();
  console.log("cleanup done");
}
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

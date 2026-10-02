// Firebase Admin 연결 점검: 서비스 계정으로 Auth·Firestore 에 접근되는지만 확인한다. 비밀값은 출력하지 않는다.
// 실행: npm run check:firebase
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function readEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : "";
  } catch {
    return "";
  }
}

const raw = readEnv("FIREBASE_ADMIN_CREDENTIALS");
if (!raw) {
  console.log("FIREBASE_ADMIN_CREDENTIALS 미설정");
  process.exit(1);
}
const sa = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
console.log("project:", sa.project_id);
const app = initializeApp({ credential: cert(sa) });

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`timeout ${ms}ms`)), ms))]);

try {
  const r = await withTimeout(getAuth(app).listUsers(1), 20_000);
  console.log("auth: OK (users sampled:", r.users.length, ")");
} catch (e) {
  console.log("auth: ERR", e.code ?? "", e.message);
}
try {
  const db = getFirestore(app);
  db.settings({ preferRest: true });
  const c = await withTimeout(db.listCollections(), 20_000);
  console.log("firestore: OK, collections:", c.map((x) => x.id));
} catch (e) {
  console.log("firestore: ERR", e.code ?? "", String(e.message).slice(0, 300));
}
process.exit(0);

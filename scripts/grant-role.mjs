// 운영자 역할 부여/해제: Firebase custom claim `roles` 만 바꾼다 (이메일 문자열로 권한을 판정하지 않음).
// 사용: npm run admin:grant -- <email> <superadmin|support|analyst|designer|none>
// 적용은 다음 로그인(또는 token 갱신) 후 반영된다.
import "./env-local.mjs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [email, role] = process.argv.slice(2);
const ROLES = ["superadmin", "support", "analyst", "designer"];
if (!email || !(ROLES.includes(role) || role === "none")) {
  console.log("사용법: npm run admin:grant -- <email> <" + ROLES.join("|") + "|none>");
  process.exit(1);
}
const raw = process.env.FIREBASE_ADMIN_CREDENTIALS ?? "";
const app = initializeApp({ credential: cert(JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString())) });
const auth = getAuth(app);
const user = await auth.getUserByEmail(email);
const roles = role === "none" ? [] : [role];
await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), roles });
await auth.revokeRefreshTokens(user.uid); // 기존 session 무효화 → 다시 로그인하면 새 역할 반영
const db = getFirestore(app);
db.settings({ preferRest: true });
await db.collection("auditLogs").add({ actorUid: "cli", actorRole: "cli", workspaceId: null, action: "role.set", targetId: user.uid, reason: `roles=${roles.join(",") || "none"}`, at: FieldValue.serverTimestamp() });
console.log(`roles for ${email} (${user.uid}) = [${roles.join(", ")}]. 다시 로그인하면 반영됩니다.`);
process.exit(0);

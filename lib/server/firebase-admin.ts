import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Firebase Admin 은 lib/server 에서만 사용한다 (CLAUDE.md). 비밀값은 로그에 남기지 않는다.

const APP_NAME = "katcha-admin";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

function readCredentials(): ServiceAccount | null {
  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS?.trim();
  if (!raw) return null;
  try {
    // JSON 원문 또는 base64 인코딩 모두 허용
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

export function isAdminConfigured(): boolean {
  return readCredentials() !== null;
}

function adminApp(): App {
  if (getApps().some((a) => a.name === APP_NAME)) return getApp(APP_NAME);
  const sa = readCredentials();
  if (!sa) throw new AdminNotConfiguredError();
  return initializeApp(
    {
      credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
      projectId: sa.project_id,
    },
    APP_NAME,
  );
}

export class AdminNotConfiguredError extends Error {
  constructor() {
    super("firebase_admin_not_configured");
  }
}

export function adminAuth() {
  return getAuth(adminApp());
}

/** Firebase Storage 버킷. 기본값은 `<projectId>.firebasestorage.app` (FIREBASE_STORAGE_BUCKET 로 변경 가능) */
export function adminBucket() {
  const sa = readCredentials();
  const name = process.env.FIREBASE_STORAGE_BUCKET || (sa ? `${sa.project_id}.firebasestorage.app` : "");
  return getStorage(adminApp()).bucket(name);
}

// 같은 Firebase app 의 Firestore 인스턴스는 프로세스에 하나다. 경로별로 따로 묶인 모듈이 각자 settings() 를
// 부르면 "already been initialized" 오류가 나서(간헐적 세션 검증 실패의 원인, 2026-10-04 확인) 프로세스 전역에서 한 번만 설정한다.
const globalForDb = globalThis as unknown as { __katchaFirestore?: Firestore };
export function adminDb(): Firestore {
  if (globalForDb.__katchaFirestore) return globalForDb.__katchaFirestore;
  const db = getFirestore(adminApp());
  try {
    // gRPC 연결이 일부 네트워크에서 멈춰 REST 전송을 쓴다 (2026-10-02 로컬 확인).
    db.settings({ preferRest: true, ignoreUndefinedProperties: true });
  } catch {
    // 다른 모듈 인스턴스가 이미 설정한 경우 — 같은 인스턴스를 그대로 쓴다
  }
  globalForDb.__katchaFirestore = db;
  return db;
}

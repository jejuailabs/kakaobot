import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

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

let db: Firestore | null = null;
export function adminDb(): Firestore {
  if (db) return db;
  db = getFirestore(adminApp());
  // gRPC 연결이 일부 네트워크에서 멈춰 REST 전송을 쓴다 (2026-10-02 로컬 확인).
  db.settings({ preferRest: true, ignoreUndefinedProperties: true });
  return db;
}

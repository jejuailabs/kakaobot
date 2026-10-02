import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { BOT_LIMITS } from "@/lib/shared/domain";
import { adminDb } from "./firebase-admin";

export type UserStatus = "active" | "suspended" | "deleting";

export type UserRecord = {
  uid: string;
  displayName: string;
  email: string;
  locale: string;
  theme: "system" | "light" | "dark";
  status: UserStatus;
  workspaceId: string;
};

/** 고객 1명당 개인 workspace 1개. ID 는 uid 에서 결정적으로 만든다 (클라이언트 입력을 쓰지 않는다). */
export function workspaceIdFor(uid: string) {
  return `ws_${uid}`;
}

/** 로그인 시 users / workspaces 문서를 만들거나 lastLoginAt 을 갱신한다. */
export async function ensureUserAndWorkspace(input: { uid: string; email: string; displayName: string; locale: string }): Promise<UserRecord> {
  const db = adminDb();
  const userRef = db.collection("users").doc(input.uid);
  const wsId = workspaceIdFor(input.uid);
  const wsRef = db.collection("workspaces").doc(wsId);

  return db.runTransaction(async (tx) => {
    const [userSnap, wsSnap] = await Promise.all([tx.get(userRef), tx.get(wsRef)]);
    if (!userSnap.exists) {
      tx.set(userRef, {
        uid: input.uid,
        displayName: input.displayName,
        email: input.email,
        locale: input.locale,
        theme: "system",
        status: "active",
        workspaceId: wsId,
        createdAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(userRef, { lastLoginAt: FieldValue.serverTimestamp(), displayName: input.displayName, email: input.email });
    }
    if (!wsSnap.exists) {
      tx.set(wsRef, {
        id: wsId,
        ownerUid: input.uid,
        status: "active",
        limits: { maxBots: BOT_LIMITS.maxBotsPerWorkspace, dailyRequests: 100, workspacePerMinute: 20, roomPerMinute: 5 },
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    const existing = userSnap.exists ? (userSnap.data() as Partial<UserRecord>) : {};
    return {
      uid: input.uid,
      displayName: input.displayName,
      email: input.email,
      locale: existing.locale ?? input.locale,
      theme: existing.theme ?? "system",
      status: existing.status ?? "active",
      workspaceId: wsId,
    };
  });
}

export async function getUserRecord(uid: string): Promise<UserRecord | null> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return snap.exists ? (snap.data() as UserRecord) : null;
}

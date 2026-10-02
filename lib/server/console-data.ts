import "server-only";
import type { Bot, ConsoleSnapshot } from "@/lib/shared/domain";
import { adminDb } from "./firebase-admin";
import type { SessionUser } from "./session";

/**
 * 실제 콘솔 초기 데이터. 모든 query 에 session 에서 확정한 workspaceId 조건을 건다.
 * demo 숫자는 절대 섞지 않는다 — 데이터가 없으면 빈 배열과 0 이 그대로 보인다.
 */
export async function loadConsoleSnapshot(user: SessionUser): Promise<ConsoleSnapshot> {
  const db = adminDb();
  const [botsSnap, wsSnap] = await Promise.all([
    db.collection("bots").where("workspaceId", "==", user.workspaceId).limit(20).get(),
    db.collection("workspaces").doc(user.workspaceId).get(),
  ]);
  const bots = botsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as Bot);
  const maxBots = (wsSnap.data()?.limits?.maxBots as number | undefined) ?? 3;

  return {
    user: { displayName: user.displayName || user.email, email: user.email },
    bots,
    rooms: [],
    joinRequests: [],
    pairingCodes: [],
    prompts: [],
    usage: [],
    activities: [],
    // gateway heartbeat 는 S4 에서 연결. 확인 전에는 "unknown" 으로 둔다(정상이라고 꾸미지 않음).
    gateway: { health: "unknown", lastCheckedAt: null },
    // LLM provider 는 S5 에서 서버 allowlist 로 채운다.
    models: [],
    searchConfigured: false,
    limits: { maxBots },
  };
}

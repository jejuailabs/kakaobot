import "server-only";
import type { ConsoleSnapshot } from "@/lib/shared/domain";
import { listActivities, listBots, listPrompts } from "./bots";
import type { SessionUser } from "./session";
import { maxBotsFor } from "./workspace-limits";

/**
 * 실제 콘솔 초기 데이터. 모든 query 에 session 에서 확정한 workspaceId 조건을 건다.
 * demo 숫자는 절대 섞지 않는다 — 데이터가 없으면 빈 배열과 0 이 그대로 보인다.
 */
export async function loadConsoleSnapshot(user: SessionUser): Promise<ConsoleSnapshot> {
  const [bots, prompts, activities, maxBots] = await Promise.all([
    listBots(user.workspaceId),
    listPrompts(user.workspaceId),
    listActivities(user.workspaceId),
    maxBotsFor(user.workspaceId),
  ]);

  return {
    user: { displayName: user.displayName || user.email, email: user.email },
    bots,
    rooms: [], // S4 에서 roomBindings 로 채운다
    joinRequests: [], // S4
    pairingCodes: [], // S4 (원문 코드는 발급 응답에서만 받는다)
    prompts,
    usage: [], // S5 usageDaily
    activities,
    // gateway heartbeat 는 S4 에서 연결. 확인 전에는 "unknown" 으로 둔다(정상이라고 꾸미지 않음).
    gateway: { health: "unknown", lastCheckedAt: null },
    // "default" = AI 제공사 연결(S5) 후 그 제공사의 기본 모델을 쓴다. 화면에 그 사실을 표시한다.
    models: [{ id: "default", label: "default", provider: "pending", configured: true }],
    searchConfigured: false,
    limits: { maxBots },
  };
}

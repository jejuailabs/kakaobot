import "server-only";
import type { ConsoleSnapshot } from "@/lib/shared/domain";
import { listActivities, listBots, listPrompts } from "./bots";
import { gatewayStatus, listJoinRequests, listRooms } from "./connection";
import type { SessionUser } from "./session";
import { maxBotsFor } from "./workspace-limits";

/**
 * 실제 콘솔 초기 데이터. 모든 query 에 session 에서 확정한 workspaceId 조건을 건다.
 * demo 숫자는 절대 섞지 않는다 — 데이터가 없으면 빈 배열과 0 이 그대로 보인다.
 */
export async function loadConsoleSnapshot(user: SessionUser): Promise<ConsoleSnapshot> {
  const [bots, prompts, activities, maxBots, rooms, joinRequests, gateway] = await Promise.all([
    listBots(user.workspaceId),
    listPrompts(user.workspaceId),
    listActivities(user.workspaceId),
    maxBotsFor(user.workspaceId),
    listRooms(user.workspaceId),
    listJoinRequests(user.workspaceId),
    gatewayStatus(),
  ]);

  return {
    user: { displayName: user.displayName || user.email, email: user.email },
    bots,
    rooms,
    joinRequests,
    pairingCodes: [], // 원문 코드는 발급 응답에서만 받는다 (서버는 hash 만 보관)
    prompts,
    usage: [], // S5 usageDaily
    activities,
    // heartbeat 가 없으면 "unknown" (정상이라고 꾸미지 않음)
    gateway,
    // "default" = AI 제공사 연결(S5) 후 그 제공사의 기본 모델을 쓴다. 화면에 그 사실을 표시한다.
    models: [{ id: "default", label: "default", provider: "pending", configured: true }],
    searchConfigured: false,
    limits: { maxBots },
  };
}

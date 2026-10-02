import "server-only";
import type { ConsoleSnapshot, UsageDay } from "@/lib/shared/domain";
import { adminDb } from "./firebase-admin";
import { DEFAULT_MODEL, isLlmConfigured, MODELS } from "./llm";
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
  const usage = await loadUsage(user.workspaceId);

  return {
    user: { displayName: user.displayName || user.email, email: user.email },
    bots,
    rooms,
    joinRequests,
    pairingCodes: [], // 원문 코드는 발급 응답에서만 받는다 (서버는 hash 만 보관)
    prompts,
    usage,
    activities,
    // heartbeat 가 없으면 "unknown" (정상이라고 꾸미지 않음)
    gateway,
    // "default" = 서버 기본 모델. 키가 없으면 이름 대신 "연결 후 적용" 으로 표시한다.
    models: [{ id: "default", label: isLlmConfigured() ? MODELS[DEFAULT_MODEL].label : "default", provider: "openai", configured: true }],
    searchConfigured: false,
    limits: { maxBots },
  };
}

/** 최근 90일 usageDaily (UTC 날짜). 값이 없는 날은 0 으로 채운다. */
async function loadUsage(workspaceId: string): Promise<UsageDay[]> {
  const snap = await adminDb().collection("usageDaily").where("workspaceId", "==", workspaceId).limit(120).get();
  const byDate = new Map(snap.docs.map((d) => [d.data().date as string, d.data()]));
  if (byDate.size === 0) return [];
  const out: UsageDay[] = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const x = byDate.get(date);
    const succeeded = (x?.succeeded as number | undefined) ?? 0;
    const failed = (x?.failed as number | undefined) ?? 0;
    out.push({ date, requests: succeeded + failed, succeeded, failed });
  }
  return out;
}

import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DemoAdminData, DemoAudit, DemoConversation, DemoGateway, DemoJob, DemoMember, MemberStatus } from "@/lib/shared/demo-admin";
import type { UsageDay } from "@/lib/shared/domain";
import { maskText } from "@/lib/shared/masking";
import { apiError } from "./api";
import { adminAuth, adminDb } from "./firebase-admin";

// 운영자 화면 데이터 (docs/07). 원문 대화는 여기서 항상 마스킹해서 내려보내고,
// 원문은 revealConversation(권한·사유·감사) 으로만 돌려준다.

const db = () => adminDb();
const ts = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : new Date(0).toISOString());
const monthKey = () => new Date().toISOString().slice(0, 7);

export type AdminMetrics = {
  members: number;
  newMembers30d: number;
  dau: number;
  mau: number;
  activeBots: number;
  rooms: number;
  p95LatencyMs: number | null;
  monthCostMicros: number;
  modelShare: { label: string; value: number }[];
  errors: { key: string; value: number }[];
};

export type LiveAdminData = DemoAdminData & { usage: UsageDay[]; metrics: AdminMetrics };

export async function loadAdminData(): Promise<LiveAdminData> {
  const now = Date.now();
  const [users, workspaces, bots, rooms, monthly, daily, logs, audit, jobs, deliveries, gateways] = await Promise.all([
    db().collection("users").limit(500).get(),
    db().collection("workspaces").limit(500).get(),
    db().collection("bots").limit(2000).get(),
    db().collection("roomBindings").limit(2000).get(),
    db().collection("usageMonthly").where("month", "==", monthKey()).limit(500).get(),
    db().collection("usageDaily").where("date", ">=", new Date(now - 89 * 86_400_000).toISOString().slice(0, 10)).limit(5000).get(),
    db().collection("conversationLogs").orderBy("createdAt", "desc").limit(200).get(),
    db().collection("auditLogs").orderBy("at", "desc").limit(200).get(),
    db().collection("jobs").where("state", "in", ["failed", "cost_unknown"]).limit(100).get(),
    db().collection("deliveries").where("state", "in", ["unknown", "failed"]).limit(100).get(),
    db().collection("gateways").limit(10).get(),
  ]);

  const wsById = new Map(workspaces.docs.map((d) => [d.id, d.data()]));
  const userByWs = new Map(users.docs.map((d) => [d.data().workspaceId as string, d.data()]));
  const botsAlive = bots.docs.filter((d) => !d.data().deletedAt);
  const botById = new Map(bots.docs.map((d) => [d.id, d.data()]));
  const roomsActive = rooms.docs.filter((d) => d.data().state !== "unbound");
  const roomByKey = new Map(rooms.docs.map((d) => [d.id, d.data()]));
  const monthByWs = new Map(monthly.docs.map((d) => [d.data().workspaceId as string, d.data()]));
  const monthReq = new Map<string, number>();
  for (const d of daily.docs) {
    const x = d.data();
    if ((x.date as string).startsWith(monthKey())) monthReq.set(x.workspaceId, (monthReq.get(x.workspaceId) ?? 0) + ((x.succeeded ?? 0) + (x.failed ?? 0)));
  }

  const members: DemoMember[] = users.docs.map((d) => {
    const u = d.data();
    const ws = u.workspaceId as string;
    return {
      uid: d.id,
      displayName: u.displayName ?? "",
      email: u.email ?? "",
      joinedAt: ts(u.createdAt),
      lastSeenAt: ts(u.lastLoginAt),
      bots: botsAlive.filter((b) => b.data().workspaceId === ws).length,
      rooms: roomsActive.filter((r) => r.data().workspaceId === ws).length,
      monthRequests: monthReq.get(ws) ?? 0,
      monthCostMicros: (monthByWs.get(ws)?.costMicros as number | undefined) ?? 0,
      status: (u.status as MemberStatus) ?? "active",
      dailyLimit: (wsById.get(ws)?.limits?.workspaceDaily as number | undefined) ?? 100,
    };
  });

  const conversations: DemoConversation[] = logs.docs.map((d) => {
    const x = d.data();
    const roomLabel = (roomByKey.get(`${x.gatewayId}__${x.roomId}`)?.label as string | undefined) ?? x.roomId;
    return {
      id: d.id,
      requestId: x.requestId ?? d.id,
      workspace: (userByWs.get(x.workspaceId)?.displayName as string | undefined) ?? x.workspaceId,
      bot: (botById.get(x.botId)?.name as string | undefined) ?? x.botId,
      room: roomLabel,
      model: x.model,
      promptVersion: x.promptVersion ?? 1,
      status: x.status === "answered" ? "answered" : "failed",
      latencyMs: x.latencyMs ?? 0,
      tokens: (x.inputTokens ?? 0) + (x.outputTokens ?? 0),
      costMicros: x.costMicros ?? 0,
      at: ts(x.createdAt),
      // 브라우저로는 마스킹본만 보낸다
      input: maskText(x.input ?? ""),
      output: maskText(x.output ?? ""),
      errorCode: x.errorCode ?? null,
    };
  });

  const auditRows: DemoAudit[] = audit.docs.map((d) => {
    const x = d.data();
    return { id: d.id, actor: x.actorUid, role: x.actorRole ?? "", action: x.action, target: x.targetId ?? "", reason: x.reason ?? "", at: ts(x.at) };
  });

  const jobRows: DemoJob[] = [
    ...jobs.docs.map((d) => ({ id: d.id, kind: "ai" as const, state: d.data().state === "cost_unknown" ? ("unknown" as const) : ("failed" as const), errorCode: d.data().errorCode ?? "", attempt: d.data().attempt ?? 0, at: ts(d.data().finishedAt ?? d.data().createdAt), target: `job ${d.id.slice(0, 24)}` })),
    ...deliveries.docs.map((d) => ({ id: `delivery:${d.id}`, kind: "ai" as const, state: d.data().state === "unknown" ? ("unknown" as const) : ("failed" as const), errorCode: d.data().state === "unknown" ? "delivery_unknown" : "delivery_failed", attempt: d.data().attempt ?? 0, at: ts(d.data().ackAt ?? d.data().createdAt), target: `delivery ${d.id.slice(0, 24)}` })),
  ];

  const gatewayRows: DemoGateway[] = gateways.docs.map((d) => {
    const x = d.data();
    const last = (x.lastHeartbeat as Timestamp | undefined)?.toMillis() ?? 0;
    const age = now - last;
    return {
      id: d.id,
      label: d.id,
      health: !last ? "offline" : age < 90_000 ? "online" : age < 180_000 ? "degraded" : "offline",
      lastHeartbeat: last ? new Date(last).toISOString() : new Date(0).toISOString(),
      adapterVersion: x.adapterVersion ?? "—",
      rooms: roomsActive.filter((r) => r.data().gatewayId === d.id).length,
      queueDepth: 0,
    };
  });

  // 플랫폼 일별 사용량
  const byDate = new Map<string, { s: number; f: number }>();
  for (const d of daily.docs) {
    const x = d.data();
    const cur = byDate.get(x.date) ?? { s: 0, f: 0 };
    byDate.set(x.date, { s: cur.s + (x.succeeded ?? 0), f: cur.f + (x.failed ?? 0) });
  }
  const usage: UsageDay[] = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    const v = byDate.get(date) ?? { s: 0, f: 0 };
    usage.push({ date, requests: v.s + v.f, succeeded: v.s, failed: v.f });
  }

  // DAU/MAU: 로그인 기준 (방 참여자 수가 아님)
  const lastLogins = users.docs.map((d) => (d.data().lastLoginAt as Timestamp | undefined)?.toMillis() ?? 0);
  const latencies = logs.docs.filter((d) => d.data().status === "answered").map((d) => d.data().latencyMs as number).sort((a, b) => a - b);
  const p95 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : null;
  const modelCount = new Map<string, number>();
  const errorCount = new Map<string, number>();
  for (const d of logs.docs) {
    modelCount.set(d.data().model, (modelCount.get(d.data().model) ?? 0) + 1);
    if (d.data().errorCode) errorCount.set(d.data().errorCode, (errorCount.get(d.data().errorCode) ?? 0) + 1);
  }
  const totalModels = [...modelCount.values()].reduce((a, b) => a + b, 0);

  const signups = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date, value: users.docs.filter((d) => ts(d.data().createdAt).startsWith(date)).length };
  });

  return {
    members,
    conversations,
    audit: auditRows,
    jobs: jobRows,
    gateways: gatewayRows,
    assets: [],
    joinQueue: [],
    signups,
    updatedAt: new Date(now).toISOString(),
    usage,
    metrics: {
      members: members.length,
      newMembers30d: users.docs.filter((d) => ((d.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0) > now - 30 * 86_400_000).length,
      dau: lastLogins.filter((t) => t > now - 86_400_000).length,
      mau: lastLogins.filter((t) => t > now - 30 * 86_400_000).length,
      activeBots: botsAlive.filter((b) => b.data().state === "active").length,
      rooms: roomsActive.length,
      p95LatencyMs: p95,
      monthCostMicros: monthly.docs.reduce((a, d) => a + ((d.data().costMicros as number | undefined) ?? 0), 0),
      modelShare: [...modelCount.entries()].map(([label, n]) => ({ label, value: totalModels ? n / totalModels : 0 })),
      errors: [...errorCount.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 6),
    },
  };
}

function audit(actor: { uid: string; roles: string[] }, action: string, targetId: string, reason: string, workspaceId: string | null = null) {
  return db().collection("auditLogs").add({ actorUid: actor.uid, actorRole: actor.roles.join(","), workspaceId, action, targetId, reason: reason.slice(0, 500), at: FieldValue.serverTimestamp() });
}

/** 회원 정지/복원: 정지 시 session 을 즉시 무효화하고 신규 LLM·송신을 막는다. 방 퇴장은 별도 운영 요청. */
export async function setMemberStatus(actor: { uid: string; roles: string[] }, uid: string, status: "active" | "suspended", reason: string) {
  const ref = db().collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw apiError(404, "not_found");
  const ws = snap.data()!.workspaceId as string;
  await ref.update({ status });
  await db().collection("workspaces").doc(ws).set({ status }, { merge: true });
  if (status === "suspended") await adminAuth().revokeRefreshTokens(uid);
  await audit(actor, status === "suspended" ? "member.suspend" : "member.restore", uid, reason, ws);
}

export async function setMemberLimit(actor: { uid: string; roles: string[] }, uid: string, dailyLimit: number, reason: string) {
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 10_000) throw apiError(400, "validation", "errors.validation");
  const snap = await db().collection("users").doc(uid).get();
  if (!snap.exists) throw apiError(404, "not_found");
  const ws = snap.data()!.workspaceId as string;
  await db().collection("workspaces").doc(ws).set({ limits: { workspaceDaily: dailyLimit } }, { merge: true });
  await audit(actor, "member.limit", `${uid} → ${dailyLimit}`, reason, ws);
}

/** 원문 열람: 권한·사유 필수, 열람 행위를 감사 기록. API 키·연결코드는 저장 단계에서 이미 제거됨. */
export async function revealConversation(actor: { uid: string; roles: string[] }, id: string, reason: string) {
  const snap = await db().collection("conversationLogs").doc(id).get();
  if (!snap.exists) throw apiError(404, "not_found");
  await audit(actor, "conversation.reveal", id, reason, snap.data()!.workspaceId);
  return { input: snap.data()!.input as string, output: snap.data()!.output as string };
}

/** 실패 job 재시도 / 송신 불명 건은 운영자가 확인 후 명시적으로 재전송 */
export async function retryJob(actor: { uid: string; roles: string[] }, id: string) {
  if (id.startsWith("delivery:")) {
    const ref = db().collection("deliveries").doc(id.slice(9));
    const snap = await ref.get();
    if (!snap.exists) throw apiError(404, "not_found");
    await ref.update({ state: "queued", attempt: 0, manualResendBy: actor.uid });
    await audit(actor, "delivery.manual_resend", id, "operator confirmed", snap.data()!.workspaceId);
    return { kind: "delivery" as const };
  }
  const ref = db().collection("jobs").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw apiError(404, "not_found");
  await ref.update({ state: "queued", errorCode: null });
  await audit(actor, "job.retry", id, "manual retry", snap.data()!.workspaceId);
  return { kind: "job" as const, jobId: id };
}

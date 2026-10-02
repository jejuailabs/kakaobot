import "server-only";
import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import type { GatewayStatus, JoinRequest, Room } from "@/lib/shared/domain";
import { BOT_LIMITS } from "@/lib/shared/domain";
import type { NormalizedEvent } from "@/lib/shared/gateway-contract";
import { generatePairingCode, parseConnectCommand } from "@/lib/shared/pairing";
import { fieldErrors, joinRequestSchema } from "@/lib/shared/schemas";
import { connectedText } from "@/lib/shared/prompt";
import { matchTrigger } from "@/lib/shared/trigger";
import { apiError } from "./api";
import { adminDb } from "./firebase-admin";

const db = () => adminDb();

function isAlreadyExists(e: unknown) {
  const code = (e as { code?: unknown }).code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS" || /already exists/i.test(String((e as Error).message));
}
const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function ownedBotRef(botId: string) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(botId)) throw apiError(404, "not_found");
  return db().collection("bots").doc(botId);
}

/* ───────────── 고객: 입장 요청 ───────────── */
export async function requestJoin(workspaceId: string, botId: string, body: unknown): Promise<JoinRequest> {
  const parsed = joinRequestSchema.safeParse(body);
  if (!parsed.success) throw apiError(400, "validation", "errors.validation", fieldErrors(parsed.error));
  const botRef = ownedBotRef(botId);
  const jrRef = db().collection("joinRequests").doc(botId); // bot 당 진행 중 요청 1개
  return db().runTransaction(async (tx) => {
    const bot = await tx.get(botRef);
    if (!bot.exists || bot.data()?.workspaceId !== workspaceId || bot.data()?.deletedAt) throw apiError(404, "not_found");
    if (bot.data()?.state !== "draft") throw apiError(409, "invalid_state");
    const doc = {
      workspaceId,
      botId,
      url: parsed.data.url,
      roomLabel: parsed.data.roomLabel,
      permissionConfirmed: true,
      noticeConfirmed: true,
      operatorApproved: false,
      state: "pending",
      rejectReasonKey: null,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(jrRef, doc);
    tx.update(botRef, { state: "awaiting_join", version: (bot.data()?.version ?? 1) + 1, updatedAt: FieldValue.serverTimestamp() });
    return { id: botId, botId, url: doc.url, roomLabel: doc.roomLabel, permissionConfirmed: true, noticeConfirmed: true, state: "pending", rejectReasonKey: null, createdAt: new Date().toISOString() };
  });
}

/* ───────────── 고객: 연결 코드 발급 ─────────────
 * 운영자 입장 승인(awaiting_code) 이후에만. 원문 코드는 응답으로 한 번만 주고 서버에는 hash 만 저장.
 * 재발급하면 이전 코드는 폐기. bot 당 10분에 5회까지. */
export async function issuePairingCode(workspaceId: string, botId: string) {
  const botRef = ownedBotRef(botId);
  const jrRef = db().collection("joinRequests").doc(botId);
  const code = generatePairingCode();
  const hash = await sha256(code);
  const expiresAt = Timestamp.fromMillis(Date.now() + BOT_LIMITS.pairingTtlMinutes * 60_000);

  await db().runTransaction(async (tx) => {
    const [bot, jr, old] = await Promise.all([tx.get(botRef), tx.get(jrRef), tx.get(db().collection("pairingTokens").where("botId", "==", botId).where("workspaceId", "==", workspaceId))]);
    if (!bot.exists || bot.data()?.workspaceId !== workspaceId || bot.data()?.deletedAt) throw apiError(404, "not_found");
    if (bot.data()?.state !== "awaiting_code" || jr.data()?.operatorApproved !== true) throw apiError(409, "invalid_state");
    const windowStart = (jr.data()?.issueWindowStart as Timestamp | undefined)?.toMillis() ?? 0;
    const inWindow = Date.now() - windowStart < 10 * 60_000;
    const count = inWindow ? ((jr.data()?.issueCount as number | undefined) ?? 0) : 0;
    if (count >= 5) throw apiError(429, "limit", "errors.limit");
    old.docs.forEach((d) => tx.delete(d.ref));
    tx.set(db().collection("pairingTokens").doc(hash), { tokenHash: hash, workspaceId, botId, requestId: botId, expiresAt, usedAt: null, createdAt: FieldValue.serverTimestamp() });
    tx.update(jrRef, { issueCount: count + 1, issueWindowStart: inWindow ? jr.data()?.issueWindowStart : FieldValue.serverTimestamp() });
  });
  return { botId, code, expiresAt: expiresAt.toDate().toISOString() };
}

/* ───────────── 운영자: 입장 확인 / 거절 ───────────── */
export async function listJoinQueue() {
  const snap = await db().collection("joinRequests").where("state", "in", ["pending", "awaiting_code"]).limit(100).get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      return { id: d.id, workspaceId: x.workspaceId as string, botId: x.botId as string, url: x.url as string, roomLabel: x.roomLabel as string, state: x.state as string, createdAt: iso(x.createdAt) ?? "" };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function resolveJoin(requestId: string, decision: "joined" | "rejected", actor: { uid: string; roles: string[] }, reason: string) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(requestId)) throw apiError(404, "not_found");
  const jrRef = db().collection("joinRequests").doc(requestId);
  await db().runTransaction(async (tx) => {
    const jr = await tx.get(jrRef);
    if (!jr.exists || jr.data()?.state !== "pending") throw apiError(409, "invalid_state");
    const botRef = db().collection("bots").doc(jr.data()!.botId);
    const bot = await tx.get(botRef);
    if (!bot.exists || bot.data()?.deletedAt) throw apiError(404, "not_found");
    const v = (bot.data()?.version ?? 1) + 1;
    if (decision === "joined") {
      tx.update(jrRef, { state: "awaiting_code", operatorApproved: true, approvedBy: actor.uid, approvedAt: FieldValue.serverTimestamp() });
      tx.update(botRef, { state: "awaiting_code", version: v, updatedAt: FieldValue.serverTimestamp() });
    } else {
      tx.update(jrRef, { state: "rejected", operatorApproved: false, rejectReasonKey: "connection.rejectedDefault" });
      tx.update(botRef, { state: "draft", version: v, updatedAt: FieldValue.serverTimestamp() });
    }
    tx.set(db().collection("auditLogs").doc(), {
      actorUid: actor.uid,
      actorRole: actor.roles.join(","),
      workspaceId: jr.data()!.workspaceId,
      action: decision === "joined" ? "join.approve" : "join.reject",
      targetId: requestId,
      reason,
      at: FieldValue.serverTimestamp(),
    });
  });
}

/* ───────────── 고객 화면용 조회 ───────────── */
export async function listRooms(workspaceId: string): Promise<Room[]> {
  const snap = await db().collection("roomBindings").where("workspaceId", "==", workspaceId).limit(50).get();
  return snap.docs
    .filter((d) => d.data().state !== "unbound")
    .map((d) => {
      const x = d.data();
      return { id: d.id, botId: x.botId, label: x.label ?? "", state: x.state === "paused" ? "paused" : "connected", lastMessageAt: iso(x.lastMessageAt), messages7d: x.messages7d ?? 0, retentionDays: x.loggingPolicy?.retentionDays ?? 30 };
    });
}

export async function listJoinRequests(workspaceId: string): Promise<JoinRequest[]> {
  const snap = await db().collection("joinRequests").where("workspaceId", "==", workspaceId).limit(50).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, botId: x.botId, url: x.url ?? "", roomLabel: x.roomLabel, permissionConfirmed: true, noticeConfirmed: true, state: x.state, rejectReasonKey: x.rejectReasonKey ?? null, createdAt: iso(x.createdAt) ?? new Date().toISOString() };
  });
}

export async function activePairingExpiries(workspaceId: string) {
  const snap = await db().collection("pairingTokens").where("workspaceId", "==", workspaceId).limit(20).get();
  return snap.docs.filter((d) => !d.data().usedAt && (d.data().expiresAt as Timestamp).toMillis() > Date.now()).map((d) => ({ botId: d.data().botId as string, expiresAt: (d.data().expiresAt as Timestamp).toDate().toISOString() }));
}

export async function setRetention(workspaceId: string, roomId: string, days: unknown): Promise<Room> {
  if (days !== 7 && days !== 30 && days !== 90) throw apiError(400, "validation", "errors.validation");
  const ref = db().collection("roomBindings").doc(roomId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.workspaceId !== workspaceId) throw apiError(404, "not_found");
  await ref.update({ "loggingPolicy.retentionDays": days });
  const x = snap.data()!;
  return { id: roomId, botId: x.botId, label: x.label ?? "", state: x.state === "paused" ? "paused" : "connected", lastMessageAt: iso(x.lastMessageAt), messages7d: x.messages7d ?? 0, retentionDays: days };
}

/** heartbeat 30초 주기 · 90초 무응답 degraded · 180초 offline (docs/06) */
export async function gatewayStatus(): Promise<GatewayStatus> {
  const snap = await db().collection("gateways").limit(5).get();
  if (snap.empty) return { health: "unknown", lastCheckedAt: null };
  const last = Math.max(...snap.docs.map((d) => (d.data().lastHeartbeat as Timestamp | undefined)?.toMillis() ?? 0));
  if (!last) return { health: "unknown", lastCheckedAt: null };
  const age = Date.now() - last;
  return { health: age < 90_000 ? "online" : age < 180_000 ? "degraded" : "offline", lastCheckedAt: new Date(last).toISOString() };
}

/* ───────────── gateway ingress ───────────── */

/** nonce 재사용 방지: 같은 nonce 는 한 번만 (10분 보관) */
export async function consumeNonce(gatewayId: string, nonce: string): Promise<boolean> {
  try {
    await db().collection("gatewayNonces").doc(`${gatewayId}__${nonce.replace(/[^A-Za-z0-9-]/g, "")}`).create({ expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60_000) });
    return true;
  } catch (e) {
    // 이미 존재(ALREADY_EXISTS=6)만 재사용으로 본다. 다른 오류는 숨기지 않는다.
    if (isAlreadyExists(e)) return false;
    throw e;
  }
}

export async function recordHeartbeat(gatewayId: string, status: string, adapterVersion: string) {
  await db().collection("gateways").doc(gatewayId).set({ id: gatewayId, status, adapterVersion, lastHeartbeat: FieldValue.serverTimestamp() }, { merge: true });
}

export type EventOutcome = "duplicate" | "ignored_self" | "ignored_unbound" | "ignored_no_trigger" | "connected" | "connect_rejected" | "queued";

/**
 * 이벤트 저장 → 처리. 같은 eventId 는 한 번만 처리한다(at-least-once 전달 대비).
 * 미연결 방·일반 대화는 LLM 으로 보내지 않는다.
 */
export async function ingestEvent(ev: NormalizedEvent): Promise<{ outcome: EventOutcome; reason?: string; jobId?: string }> {
  const eventRef = db().collection("events").doc(encodeURIComponent(ev.eventId));
  try {
    await eventRef.create({ ...ev, state: "stored", storedAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86_400_000) });
  } catch (e) {
    if (isAlreadyExists(e)) return { outcome: "duplicate" };
    throw e;
  }
  const finish = async (outcome: EventOutcome, reason?: string) => {
    await eventRef.update({ state: outcome === "queued" ? "queued" : outcome === "connected" ? "completed" : "ignored", outcome, reason: reason ?? null });
    return { outcome, reason };
  };

  if (ev.isSelf || ev.kind !== "text") return finish("ignored_self");

  const code = parseConnectCommand(ev.text);
  if (code) {
    const r = await claimRoom(ev, code);
    return finish(r.ok ? "connected" : "connect_rejected", r.ok ? undefined : r.reason);
  }

  const binding = await db().collection("roomBindings").doc(`${ev.gatewayId}__${ev.roomId}`).get();
  if (!binding.exists || binding.data()?.state !== "connected") return finish("ignored_unbound");
  const bot = await db().collection("bots").doc(binding.data()!.botId).get();
  if (!bot.exists || bot.data()?.state !== "active" || bot.data()?.deletedAt) return finish("ignored_unbound");
  const m = matchTrigger(ev.text, bot.data()!.trigger ?? "!AI");
  if (m.kind === "none") return finish("ignored_no_trigger");

  // AI 처리 job (S5 에서 claim·LLM 호출). eventId 를 job ID 로 써서 중복 생성 방지.
  await db().collection("jobs").doc(eventRef.id).set(
    {
      eventId: ev.eventId,
      workspaceId: binding.data()!.workspaceId,
      botId: binding.data()!.botId,
      gatewayId: ev.gatewayId,
      roomId: ev.roomId,
      senderId: ev.senderId,
      kind: m.kind,
      question: m.kind === "question" ? m.question : "",
      state: "queued",
      attempt: 0,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
  await db().collection("roomBindings").doc(binding.id).update({ lastMessageAt: FieldValue.serverTimestamp() });
  return { ...(await finish("queued")), jobId: eventRef.id };
}

type ClaimResult = { ok: true; botId: string } | { ok: false; reason: string };

/** 원자적 연결: 미사용·미만료 코드 + 운영자 승인 + bot awaiting_code + 방 미점유 → binding 생성·코드 사용·bot 활성 */
export async function claimRoom(ev: Pick<NormalizedEvent, "gatewayId" | "roomId" | "eventId">, code: string): Promise<ClaimResult> {
  // 방 단위 실패 시도 제한: 10분에 10회
  const attemptsRef = db().collection("pairingAttempts").doc(`${ev.gatewayId}__${ev.roomId}`);
  const attempts = await attemptsRef.get();
  const windowStart = (attempts.data()?.windowStart as Timestamp | undefined)?.toMillis() ?? 0;
  const inWindow = Date.now() - windowStart < 10 * 60_000;
  if (inWindow && (attempts.data()?.count ?? 0) >= 10) return { ok: false, reason: "rate_limited" };

  const hash = await sha256(code);
  const tokenRef = db().collection("pairingTokens").doc(hash);
  const bindingRef = db().collection("roomBindings").doc(`${ev.gatewayId}__${ev.roomId}`);

  const result = await db().runTransaction<ClaimResult>(async (tx) => {
    const token = await tx.get(tokenRef);
    if (!token.exists) return { ok: false, reason: "invalid_code" };
    const t = token.data()!;
    if (t.usedAt) return { ok: false, reason: "used_code" };
    if ((t.expiresAt as Timestamp).toMillis() < Date.now()) return { ok: false, reason: "expired_code" };
    const botRef = db().collection("bots").doc(t.botId) as DocumentReference;
    const jrRef = db().collection("joinRequests").doc(t.requestId);
    const [bot, jr, binding] = await Promise.all([tx.get(botRef), tx.get(jrRef), tx.get(bindingRef)]);
    if (!bot.exists || bot.data()?.deletedAt || bot.data()?.workspaceId !== t.workspaceId) return { ok: false, reason: "invalid_code" };
    if (bot.data()?.state !== "awaiting_code") return { ok: false, reason: "bot_not_waiting" };
    if (jr.data()?.operatorApproved !== true) return { ok: false, reason: "not_approved" };
    if (binding.exists && binding.data()?.state !== "unbound") return { ok: false, reason: "room_taken" };

    const label = (jr.data()?.roomLabel as string) || (bot.data()?.name as string);
    tx.set(bindingRef, {
      gatewayId: ev.gatewayId,
      roomId: ev.roomId,
      workspaceId: t.workspaceId,
      botId: t.botId,
      label,
      state: "connected",
      loggingPolicy: { retentionDays: 30 },
      connectedAt: FieldValue.serverTimestamp(),
      connectEventId: ev.eventId,
    });
    tx.update(tokenRef, { usedAt: FieldValue.serverTimestamp(), usedRoom: bindingRef.id });
    tx.update(botRef, { state: "active", roomLabel: label, version: (bot.data()?.version ?? 1) + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.update(jrRef, { state: "connected" });
    tx.set(db().collection("activities").doc(), { workspaceId: t.workspaceId, botId: t.botId, botName: bot.data()?.name, kind: "connected", at: FieldValue.serverTimestamp() });
    // 방 안내 메시지는 outbox 로 (relay 가 poll 해서 송신). eventId 기반 ID 로 중복 생성 방지.
    tx.set(db().collection("deliveries").doc(`${encodeURIComponent(ev.eventId)}__connect`), {
      workspaceId: t.workspaceId,
      gatewayId: ev.gatewayId,
      roomId: ev.roomId,
      text: connectedText(bot.data()?.replyLocale ?? "ko", bot.data()?.trigger ?? "!AI"),
      kind: "connected",
      state: "queued",
      attempt: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, botId: t.botId };
  });

  if (!result.ok) {
    await attemptsRef.set({ windowStart: inWindow ? attempts.data()!.windowStart : FieldValue.serverTimestamp(), count: inWindow ? FieldValue.increment(1) : 1 }, { merge: true });
  }
  return result;
}

import "server-only";
import { FieldValue, Timestamp, type DocumentData, type Transaction } from "firebase-admin/firestore";
import type { Activity, Bot, PromptVersion } from "@/lib/shared/domain";
import { botInputSchema, fieldErrors, type BotInput } from "@/lib/shared/schemas";
import { apiError } from "./api";
import { adminDb } from "./firebase-admin";

// 모든 함수는 session 에서 확정한 workspaceId 를 받는다.
// 문서의 workspaceId 가 다르면 존재하지 않는 것처럼 404 로 응답한다 (docs/05).

const BOT_FIELDS = ["name", "description", "roomUrl", "locale", "timezone", "roles", "faq", "customPrompt", "trigger", "tone", "length", "replyLocale", "modelId", "dailyLimit"] as const;

const iso = (v: unknown): string => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === "string" ? v : new Date(0).toISOString());

function toBot(id: string, d: DocumentData): Bot {
  return {
    id,
    name: d.name,
    description: d.description ?? "",
    roomUrl: d.roomUrl ?? "",
    locale: d.locale ?? "ko",
    timezone: d.timezone ?? "Asia/Seoul",
    roles: d.roles ?? ["qa"],
    faq: d.faq ?? "",
    customPrompt: d.customPrompt ?? "",
    trigger: d.trigger ?? "!AI",
    tone: d.tone ?? "friendly",
    length: d.length ?? "normal",
    replyLocale: d.replyLocale ?? "ko",
    modelId: d.modelId ?? "default",
    dailyLimit: d.dailyLimit ?? 100,
    state: d.state ?? "draft",
    version: d.version ?? 1,
    promptVersion: d.promptVersion ?? 1,
    roomLabel: d.roomLabel ?? null,
    messages30d: d.messages30d ?? 0,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

function pickInput(b: Bot | BotInput): BotInput {
  return Object.fromEntries(BOT_FIELDS.map((k) => [k, b[k]])) as BotInput;
}

function validate(input: unknown): BotInput {
  const parsed = botInputSchema.safeParse(input);
  if (!parsed.success) throw apiError(400, "validation", "errors.validation", fieldErrors(parsed.error));
  return parsed.data;
}

const bots = () => adminDb().collection("bots");
const prompts = () => adminDb().collection("promptVersions");
const activities = () => adminDb().collection("activities");

async function ownedBot(tx: Transaction | null, workspaceId: string, botId: string) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(botId)) throw apiError(404, "not_found");
  const ref = bots().doc(botId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists || snap.data()?.workspaceId !== workspaceId || snap.data()?.deletedAt) throw apiError(404, "not_found");
  return { ref, data: snap.data() as DocumentData };
}

function activity(tx: Transaction, workspaceId: string, botId: string, botName: string, kind: Activity["kind"]) {
  tx.set(activities().doc(), { workspaceId, botId, botName, kind, at: FieldValue.serverTimestamp() });
}

export async function listBots(workspaceId: string): Promise<Bot[]> {
  const snap = await bots().where("workspaceId", "==", workspaceId).limit(50).get();
  return snap.docs
    .filter((d) => !d.data().deletedAt)
    .map((d) => toBot(d.id, d.data()))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getBot(workspaceId: string, botId: string): Promise<Bot> {
  const { data } = await ownedBot(null, workspaceId, botId);
  return toBot(botId, data);
}

/** 생성: Idempotency-Key 를 workspace 범위로 저장해 재시도에도 하나만 만든다. */
export async function createBot(workspaceId: string, input: unknown, idempotencyKey: string, maxBots: number): Promise<Bot> {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(idempotencyKey)) throw apiError(400, "validation", "errors.validation");
  const values = validate(input);
  const db = adminDb();
  const idemRef = db.collection("idempotencyKeys").doc(`${workspaceId}__${idempotencyKey}`);

  return db.runTransaction(async (tx) => {
    const idem = await tx.get(idemRef);
    if (idem.exists) {
      const existing = await tx.get(bots().doc(idem.data()!.botId));
      if (existing.exists && existing.data()?.workspaceId === workspaceId) return toBot(existing.id, existing.data()!);
    }
    const current = await tx.get(bots().where("workspaceId", "==", workspaceId).limit(maxBots + 5));
    const alive = current.docs.filter((d) => !d.data().deletedAt).length;
    if (alive >= maxBots) throw apiError(409, "limit", "errors.limit");

    const ref = bots().doc();
    const now = FieldValue.serverTimestamp();
    const doc = { ...values, workspaceId, state: "draft", version: 1, promptVersion: 1, roomLabel: null, messages30d: 0, createdAt: now, updatedAt: now };
    tx.set(ref, doc);
    tx.set(prompts().doc(`${ref.id}_v1`), { workspaceId, botId: ref.id, version: 1, body: values.customPrompt, faq: values.faq, createdAt: now });
    tx.set(idemRef, { workspaceId, botId: ref.id, createdAt: now, expiresAt: Timestamp.fromMillis(Date.now() + 24 * 3600_000) });
    activity(tx, workspaceId, ref.id, values.name, "settings");
    const nowIso = new Date().toISOString();
    return toBot(ref.id, { ...doc, createdAt: nowIso, updatedAt: nowIso });
  });
}

/** 수정: expectedVersion 이 다르면 409. 프롬프트·FAQ 가 바뀌면 새 버전 기록. */
export async function updateBot(workspaceId: string, botId: string, patch: unknown, expectedVersion: unknown): Promise<Bot> {
  if (typeof expectedVersion !== "number") throw apiError(400, "validation", "errors.validation");
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const { ref, data } = await ownedBot(tx, workspaceId, botId);
    const current = toBot(botId, data);
    if (current.version !== expectedVersion) throw apiError(409, "conflict", "errors.conflict");
    const merged = validate({ ...pickInput(current), ...(typeof patch === "object" && patch ? patch : {}) });
    const promptChanged = merged.customPrompt !== current.customPrompt || merged.faq !== current.faq;
    const next = { ...merged, version: current.version + 1, promptVersion: promptChanged ? current.promptVersion + 1 : current.promptVersion, updatedAt: FieldValue.serverTimestamp() };
    tx.update(ref, next);
    if (promptChanged) {
      tx.set(prompts().doc(`${botId}_v${next.promptVersion}`), { workspaceId, botId, version: next.promptVersion, body: merged.customPrompt, faq: merged.faq, createdAt: FieldValue.serverTimestamp() });
    }
    activity(tx, workspaceId, botId, merged.name, "settings");
    return { ...current, ...merged, version: next.version, promptVersion: next.promptVersion, updatedAt: new Date().toISOString() };
  });
}

/** 일시정지: room routing 만 멈추고 공용 계정을 방에서 내보내지 않는다. */
export async function setPaused(workspaceId: string, botId: string, paused: boolean, expectedVersion: unknown): Promise<Bot> {
  if (typeof expectedVersion !== "number") throw apiError(400, "validation", "errors.validation");
  return adminDb().runTransaction(async (tx) => {
    const { ref, data } = await ownedBot(tx, workspaceId, botId);
    const current = toBot(botId, data);
    if (current.version !== expectedVersion) throw apiError(409, "conflict", "errors.conflict");
    if (paused ? current.state !== "active" : current.state !== "paused") throw apiError(409, "invalid_state", "errors.invalid_state");
    // Firestore 트랜잭션: 모든 읽기를 쓰기보다 먼저 한다.
    const roomSnap = await tx.get(adminDb().collection("roomBindings").where("botId", "==", botId).where("workspaceId", "==", workspaceId).limit(1));
    const state = paused ? "paused" : "active";
    tx.update(ref, { state, version: current.version + 1, updatedAt: FieldValue.serverTimestamp() });
    for (const r of roomSnap.docs) tx.update(r.ref, { state: paused ? "paused" : "connected" });
    return { ...current, state, version: current.version + 1, updatedAt: new Date().toISOString() };
  });
}

/**
 * 삭제: 설정을 즉시 비활성화(deletedAt)하고 프롬프트 등 개인 데이터를 지운다.
 * 공용 계정의 방 퇴장은 운영자 작업으로 요청한다 (opsRequests).
 */
export async function deleteBot(workspaceId: string, botId: string): Promise<void> {
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    const { ref, data } = await ownedBot(tx, workspaceId, botId);
    const rooms = await tx.get(db.collection("roomBindings").where("botId", "==", botId).where("workspaceId", "==", workspaceId).limit(1));
    tx.update(ref, { deletedAt: FieldValue.serverTimestamp(), state: "paused", customPrompt: "", faq: "", description: "" });
    for (const r of rooms.docs) {
      tx.update(r.ref, { state: "unbound" });
      tx.set(db.collection("opsRequests").doc(), { kind: "leave_room", workspaceId, botId, gatewayId: r.data().gatewayId, roomId: r.data().roomId, createdAt: FieldValue.serverTimestamp(), state: "open" });
    }
    void data;
  });
  const promptSnap = await prompts().where("botId", "==", botId).where("workspaceId", "==", workspaceId).get();
  const batch = db.batch();
  promptSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function listPrompts(workspaceId: string): Promise<PromptVersion[]> {
  const snap = await prompts().where("workspaceId", "==", workspaceId).limit(200).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, botId: x.botId, version: x.version, body: x.body ?? "", faq: x.faq ?? "", createdAt: iso(x.createdAt) };
  });
}

export async function listActivities(workspaceId: string): Promise<Activity[]> {
  // where + orderBy 복합 index 없이 동작하도록 메모리에서 정렬한다 (workspace 당 소량).
  const snap = await activities().where("workspaceId", "==", workspaceId).limit(100).get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      return { id: d.id, kind: x.kind, botId: x.botId, botName: x.botName, at: iso(x.at) } as Activity;
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);
}

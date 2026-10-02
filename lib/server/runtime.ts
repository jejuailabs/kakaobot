import "server-only";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { buildMessages, buildSystemPrompt, failureText, finalizeReply, helpText, redactSecrets, type PromptBot, type Turn } from "@/lib/shared/prompt";
import { adminDb } from "./firebase-admin";
import { costMicros, generate, LlmError, resolveModel, type ModelSpec } from "./llm";

// 메시지 runtime (docs/07): job claim(lease) → kill switch·한도 → 비용 reserve → LLM → usage 정산 + conversationLog + outbox 를 한 transaction 으로 commit.
// Queue 전달은 at-least-once 이므로 job ID(=eventId) 와 lease 로 중복 처리를 막는다.

const db = () => adminDb();
const LEASE_MS = 90_000;
const MAX_OUTPUT_TOKENS = 1200; // 추론 토큰 포함 상한. 화면 출력은 1,200자로 다시 자른다.
const TIMEOUT_MS = 25_000;
const DEFAULT_LIMITS = { workspacePerMinute: 20, roomPerMinute: 5, workspaceDaily: 100, monthlyBudgetMicros: 5_000_000 };

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const minuteKey = (d = new Date()) => d.toISOString().slice(0, 16);

async function sha(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export async function killSwitchOn(): Promise<boolean> {
  const snap = await db().collection("system").doc("flags").get();
  return snap.data()?.killSwitch === true;
}

/** 입력 토큰 대략 추정 (한글 1~2자/토큰) — reserve 용 상한이므로 넉넉하게 잡는다 */
function estimateTokens(text: string) {
  return Math.ceil(text.length / 1.5) + 50;
}

type Reservation = { reservedMicros: number; refs: { day: FirebaseFirestore.DocumentReference; month: FirebaseFirestore.DocumentReference; botDay: FirebaseFirestore.DocumentReference } };

/**
 * 한도 확인 + 비용 reserve (transaction 안에서 호출).
 * 반환 null 이면 한도 초과.
 */
async function reserve(tx: Transaction, p: { workspaceId: string; botId: string; roomKey: string | null; dailyLimit: number; reserveMicros: number }): Promise<Reservation | "limit" | "budget" | "suspended"> {
  const ws = await tx.get(db().collection("workspaces").doc(p.workspaceId));
  // 정지된 회원: 신규 LLM 호출·송신 차단 (방 퇴장은 별도 운영 요청)
  if (ws.data()?.status === "suspended") return "suspended";
  const limits = { ...DEFAULT_LIMITS, ...(ws.data()?.limits ?? {}) };
  const day = db().collection("usageDaily").doc(`${p.workspaceId}__${dayKey()}`);
  const month = db().collection("usageMonthly").doc(`${p.workspaceId}__${monthKey()}`);
  const botDay = db().collection("botUsageDaily").doc(`${p.botId}__${dayKey()}`);
  const wsMin = db().collection("rateCounters").doc(`ws__${p.workspaceId}__${minuteKey()}`);
  const roomMin = p.roomKey ? db().collection("rateCounters").doc(`room__${p.roomKey}__${minuteKey()}`) : null;
  const [d, m, b, wm, rm] = await Promise.all([tx.get(day), tx.get(month), tx.get(botDay), tx.get(wsMin), roomMin ? tx.get(roomMin) : Promise.resolve(null)]);

  if ((wm.data()?.count ?? 0) >= limits.workspacePerMinute) return "limit";
  if (rm && (rm.data()?.count ?? 0) >= limits.roomPerMinute) return "limit";
  if ((d.data()?.requests ?? 0) >= limits.workspaceDaily) return "limit";
  if ((b.data()?.requests ?? 0) >= p.dailyLimit) return "limit";
  if ((m.data()?.costMicros ?? 0) + (m.data()?.reservedMicros ?? 0) + p.reserveMicros > limits.monthlyBudgetMicros) return "budget";

  const ttl = Timestamp.fromMillis(Date.now() + 2 * 3600_000);
  tx.set(wsMin, { count: FieldValue.increment(1), expiresAt: ttl }, { merge: true });
  if (roomMin) tx.set(roomMin, { count: FieldValue.increment(1), expiresAt: ttl }, { merge: true });
  tx.set(day, { workspaceId: p.workspaceId, date: dayKey(), requests: FieldValue.increment(1), reservedMicros: FieldValue.increment(p.reserveMicros) }, { merge: true });
  tx.set(month, { workspaceId: p.workspaceId, month: monthKey(), reservedMicros: FieldValue.increment(p.reserveMicros) }, { merge: true });
  tx.set(botDay, { workspaceId: p.workspaceId, botId: p.botId, requests: FieldValue.increment(1) }, { merge: true });
  return { reservedMicros: p.reserveMicros, refs: { day, month, botDay } };
}

function settle(tx: Transaction, r: Reservation, actual: { costMicros: number; inputTokens: number; outputTokens: number; ok: boolean }) {
  tx.set(r.refs.day, {
    reservedMicros: FieldValue.increment(-r.reservedMicros),
    costMicros: FieldValue.increment(actual.costMicros),
    inputTokens: FieldValue.increment(actual.inputTokens),
    outputTokens: FieldValue.increment(actual.outputTokens),
    succeeded: FieldValue.increment(actual.ok ? 1 : 0),
    failed: FieldValue.increment(actual.ok ? 0 : 1),
  }, { merge: true });
  tx.set(r.refs.month, { reservedMicros: FieldValue.increment(-r.reservedMicros), costMicros: FieldValue.increment(actual.costMicros) }, { merge: true });
}

async function loadHistory(threadKey: string): Promise<Turn[]> {
  const snap = await db().collection("conversationLogs").where("threadKey", "==", threadKey).limit(40).get();
  return snap.docs
    .map((d) => d.data())
    .filter((x) => x.status === "answered")
    .sort((a, b) => (a.createdAt as Timestamp).toMillis() - (b.createdAt as Timestamp).toMillis())
    .slice(-6)
    .map((x) => ({ input: x.input as string, output: x.output as string }));
}

async function callWithRetry(model: ModelSpec, system: string, messages: { role: "user" | "assistant"; content: string }[], requestId: string) {
  // 확정 429/5xx 만 재시도 (1s, 4s + jitter). 서버리스 시간 안에서 끝내고, 그 이후는 failed → 운영자 재시도.
  const delays = [1000, 4000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await generate({ model, system, messages, maxOutputTokens: MAX_OUTPUT_TOKENS, timeoutMs: TIMEOUT_MS, requestId });
    } catch (e) {
      if (e instanceof LlmError && e.retryable && attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt] + Math.random() * 300));
        continue;
      }
      throw e;
    }
  }
}

function enqueueDelivery(tx: Transaction, id: string, d: { workspaceId: string; gatewayId: string; roomId: string; text: string; kind: string }) {
  tx.set(db().collection("deliveries").doc(id), { ...d, state: "queued", attempt: 0, createdAt: FieldValue.serverTimestamp() });
}

export type JobOutcome = "skipped" | "answered" | "help" | "limited" | "failed" | "cost_unknown" | "killed";

/** POST /api/internal/jobs/process 및 ingress 직후(after)에서 호출. 같은 job 을 여러 번 불러도 한 번만 처리된다. */
export async function processJob(jobId: string): Promise<JobOutcome> {
  const jobRef = db().collection("jobs").doc(jobId);
  // 1) claim (lease)
  const claimed = await db().runTransaction(async (tx) => {
    const j = await tx.get(jobRef);
    if (!j.exists) return null;
    const x = j.data()!;
    const leaseExpired = ((x.leaseUntil as Timestamp | undefined)?.toMillis() ?? 0) < Date.now();
    const leaseOk = x.state === "queued" || (x.state === "processing" && leaseExpired);
    if (!leaseOk) return null;
    tx.update(jobRef, { state: "processing", leaseUntil: Timestamp.fromMillis(Date.now() + LEASE_MS), attempt: FieldValue.increment(1) });
    return x;
  });
  if (!claimed) return "skipped";

  const fail = async (state: string, errorCode: string) => {
    await jobRef.update({ state, errorCode, finishedAt: FieldValue.serverTimestamp() });
  };

  if (await killSwitchOn()) {
    await fail("failed", "kill_switch");
    return "killed";
  }

  const botSnap = await db().collection("bots").doc(claimed.botId).get();
  const bot = botSnap.data();
  if (!bot || bot.state !== "active" || bot.deletedAt || bot.workspaceId !== claimed.workspaceId) {
    await fail("ignored", "bot_inactive");
    return "skipped";
  }
  const deliveryBase = { workspaceId: claimed.workspaceId, gatewayId: claimed.gatewayId, roomId: claimed.roomId };
  const deliveryId = `${jobId}__reply`;

  // 빈 질문 → 도움말 (LLM 호출 없음)
  if (claimed.kind === "help") {
    await db().runTransaction(async (tx) => {
      enqueueDelivery(tx, deliveryId, { ...deliveryBase, text: helpText(bot.replyLocale ?? "ko", bot.trigger ?? "!AI", bot.name), kind: "help" });
      tx.update(jobRef, { state: "completed", finishedAt: FieldValue.serverTimestamp() });
    });
    return "help";
  }

  const model = resolveModel(bot.modelId);
  const promptBot: PromptBot = { name: bot.name, roles: bot.roles, tone: bot.tone, length: bot.length, replyLocale: bot.replyLocale, customPrompt: bot.customPrompt ?? "", faq: bot.faq ?? "" };
  const system = buildSystemPrompt(promptBot);
  const senderKey = await sha(`${claimed.gatewayId}:${claimed.senderId}`); // 원 sender ID 는 저장하지 않는다
  const threadKey = `${claimed.botId}__${claimed.gatewayId}__${claimed.roomId}__${senderKey}`;
  const history = await loadHistory(threadKey);
  const messages = buildMessages(history, claimed.question);
  const reserveMicros = costMicros(model, estimateTokens(system + messages.map((m) => m.content).join("")), MAX_OUTPUT_TOKENS);

  // 2) 한도·예산 reserve
  const reservation = await db().runTransaction(async (tx) => {
    const r = await reserve(tx, { workspaceId: claimed.workspaceId, botId: claimed.botId, roomKey: `${claimed.gatewayId}__${claimed.roomId}`, dailyLimit: bot.dailyLimit ?? 100, reserveMicros });
    if (r === "suspended") tx.update(jobRef, { state: "ignored", errorCode: "workspace_suspended", finishedAt: FieldValue.serverTimestamp() });
    if (r === "limit" || r === "budget") {
      enqueueDelivery(tx, deliveryId, { ...deliveryBase, text: failureText(bot.replyLocale ?? "ko", "limit"), kind: "limit" });
      tx.update(jobRef, { state: "completed", errorCode: r, finishedAt: FieldValue.serverTimestamp() });
    }
    return r;
  });
  if (reservation === "suspended") return "skipped";
  if (reservation === "limit" || reservation === "budget") return "limited";

  // 3) LLM
  const started = Date.now();
  const retentionDays = (await db().collection("roomBindings").doc(`${claimed.gatewayId}__${claimed.roomId}`).get()).data()?.loggingPolicy?.retentionDays ?? 30;
  const logBase = {
    workspaceId: claimed.workspaceId,
    botId: claimed.botId,
    roomId: claimed.roomId,
    gatewayId: claimed.gatewayId,
    threadKey,
    pseudonymousSenderId: senderKey,
    input: redactSecrets(claimed.question),
    model: model.id,
    promptVersion: bot.promptVersion ?? 1,
    requestId: jobId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + retentionDays * 86_400_000),
  };
  try {
    const out = await callWithRetry(model, system, messages, jobId);
    const reply = finalizeReply(out.text);
    const cost = costMicros(model, out.inputTokens, out.outputTokens, out.cachedInputTokens);
    // 4) 정산 + 로그 + outbox 를 한 transaction 으로
    await db().runTransaction(async (tx) => {
      settle(tx, reservation, { costMicros: cost, inputTokens: out.inputTokens, outputTokens: out.outputTokens, ok: true });
      tx.set(db().collection("conversationLogs").doc(jobId), { ...logBase, output: redactSecrets(reply), status: "answered", latencyMs: Date.now() - started, inputTokens: out.inputTokens, outputTokens: out.outputTokens, costMicros: cost, providerRequestId: out.providerRequestId });
      enqueueDelivery(tx, deliveryId, { ...deliveryBase, text: reply, kind: "answer" });
      tx.update(jobRef, { state: "completed", finishedAt: FieldValue.serverTimestamp(), latencyMs: Date.now() - started });
    });
    return "answered";
  } catch (e) {
    const err = e instanceof LlmError ? e : new LlmError("server", null, (e as Error).message);
    const unknownCost = err.kind === "timeout";
    await db().runTransaction(async (tx) => {
      if (unknownCost) {
        // 처리 여부·비용 불명: reserve 를 풀지 않고 reconcile 대상으로 남긴다. 재전송·재호출하지 않는다.
        tx.set(reservation.refs.day, { failed: FieldValue.increment(1), unknownCostRequests: FieldValue.increment(1) }, { merge: true });
      } else {
        settle(tx, reservation, { costMicros: 0, inputTokens: 0, outputTokens: 0, ok: false });
      }
      tx.set(db().collection("conversationLogs").doc(jobId), { ...logBase, output: "", status: "failed", errorCode: `provider_${err.kind}`, latencyMs: Date.now() - started, inputTokens: 0, outputTokens: 0, costMicros: 0 });
      enqueueDelivery(tx, deliveryId, { ...deliveryBase, text: failureText(bot.replyLocale ?? "ko", "error"), kind: "error" });
      tx.update(jobRef, { state: unknownCost ? "cost_unknown" : "failed", errorCode: `provider_${err.kind}`, errorDetail: err.message.slice(0, 200), finishedAt: FieldValue.serverTimestamp() });
    });
    console.error("[runtime] job failed", { jobId, kind: err.kind, status: err.status });
    return unknownCost ? "cost_unknown" : "failed";
  }
}

/** 콘솔 테스트 답변: 실제 모델 호출, 사용량·비용·한도 적용 (방 송신 없음) */
export async function testReply(workspaceId: string, botId: string | null, question: string, draft?: unknown): Promise<{ text: string; demo: false }> {
  const { apiError } = await import("./api");
  const { botInputSchema } = await import("@/lib/shared/schemas");
  const q = question.trim();
  if (!q || q.length > 4000) throw apiError(400, "validation", "errors.validation");
  if (await killSwitchOn()) throw apiError(503, "not_configured", "errors.not_configured");
  let bot: FirebaseFirestore.DocumentData | undefined;
  const usageBotId = botId ?? `draft__${workspaceId}`;
  if (botId) {
    bot = (await db().collection("bots").doc(botId).get()).data();
    if (!bot || bot.workspaceId !== workspaceId || bot.deletedAt) throw apiError(404, "not_found");
  } else {
    // wizard 단계: 아직 저장 전 설정값으로 테스트 (서버에서 다시 검증)
    const parsed = botInputSchema.safeParse(draft);
    if (!parsed.success) throw apiError(400, "validation", "errors.validation");
    bot = { ...parsed.data, name: parsed.data.name || "Katcha" };
  }
  const model = resolveModel(bot.modelId);
  const system = buildSystemPrompt({ name: bot.name, roles: bot.roles, tone: bot.tone, length: bot.length, replyLocale: bot.replyLocale, customPrompt: bot.customPrompt ?? "", faq: bot.faq ?? "" });
  const messages = buildMessages([], q);
  const reserveMicros = costMicros(model, estimateTokens(system + q), MAX_OUTPUT_TOKENS);
  const reservation = await db().runTransaction((tx) => reserve(tx, { workspaceId, botId: usageBotId, roomKey: null, dailyLimit: bot.dailyLimit ?? 100, reserveMicros }));
  if (reservation === "suspended") throw apiError(403, "account_suspended", "login.errorSuspended");
  if (reservation === "limit" || reservation === "budget") throw apiError(429, "limit", "errors.limit");
  try {
    const out = await callWithRetry(model, system, messages, `test_${crypto.randomUUID().slice(0, 12)}`);
    const cost = costMicros(model, out.inputTokens, out.outputTokens, out.cachedInputTokens);
    await db().runTransaction(async (tx) => settle(tx, reservation, { costMicros: cost, inputTokens: out.inputTokens, outputTokens: out.outputTokens, ok: true }));
    return { text: finalizeReply(out.text), demo: false };
  } catch (e) {
    await db().runTransaction(async (tx) => settle(tx, reservation, { costMicros: 0, inputTokens: 0, outputTokens: 0, ok: false }));
    if (e instanceof LlmError && e.kind === "not_configured") throw apiError(503, "not_configured", "errors.not_configured");
    throw apiError(502, "network", "errors.network");
  }
}

/* ───────────── relay outbox ───────────── */

/** lease 가능한 송신 최대 10개. relay 는 local journal 기록 후 송신하고 ack 한다. */
export async function leaseOutbox(gatewayId: string) {
  if (await killSwitchOn()) return [];
  const snap = await db().collection("deliveries").where("gatewayId", "==", gatewayId).where("state", "in", ["queued", "leased"]).limit(30).get();
  const now = Date.now();
  const leased: { id: string; roomId: string; text: string; createdAt: string }[] = [];
  // 정지된 회원 workspace 의 송신은 내보내지 않는다
  const suspended = new Set<string>();
  for (const wsId of new Set(snap.docs.map((d) => d.data().workspaceId as string))) {
    if ((await db().collection("workspaces").doc(wsId).get()).data()?.status === "suspended") suspended.add(wsId);
  }
  for (const d of snap.docs) {
    if (leased.length >= 10) break;
    if (suspended.has(d.data().workspaceId)) continue;
    const ok = await db().runTransaction(async (tx) => {
      const cur = await tx.get(d.ref);
      const x = cur.data();
      if (!x) return false;
      const expired = x.state === "leased" && (x.leaseUntil as Timestamp).toMillis() < now;
      // 송신 불명(unknown) 은 자동 재전송하지 않는다 — leased 만료도 attempt 3회까지만
      if (!(x.state === "queued" || (expired && (x.attempt ?? 0) < 3))) return false;
      tx.update(d.ref, { state: "leased", leaseUntil: Timestamp.fromMillis(now + 60_000), attempt: FieldValue.increment(1) });
      return true;
    });
    if (ok) leased.push({ id: d.id, roomId: d.data().roomId, text: d.data().text, createdAt: (d.data().createdAt as Timestamp | undefined)?.toDate().toISOString() ?? new Date().toISOString() });
  }
  return leased;
}

export async function ackDelivery(gatewayId: string, deliveryId: string, result: "sent" | "failed" | "unknown", detail?: string) {
  const ref = db().collection("deliveries").doc(deliveryId);
  await db().runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (!d.exists || d.data()?.gatewayId !== gatewayId) return;
    tx.update(ref, { state: result, ackAt: FieldValue.serverTimestamp(), detail: detail?.slice(0, 200) ?? null });
  });
}

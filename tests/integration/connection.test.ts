import { Timestamp } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { createBot, setPaused } from "@/lib/server/bots";
import { claimRoom, ingestEvent, issuePairingCode, requestJoin, resolveJoin } from "@/lib/server/connection";
import { adminDb } from "@/lib/server/firebase-admin";
import type { NormalizedEvent } from "@/lib/shared/gateway-contract";

const run = `it${Date.now().toString(36)}`;
const A = `ws_test_A_${run}`;
const B = `ws_test_B_${run}`;
const GW = `gw-t${Date.now().toString(36).slice(-6)}`;
const operator = { uid: "test-operator", roles: ["superadmin"] };

const input = (name: string) => ({ name, description: "", roomUrl: "", locale: "ko", timezone: "Asia/Seoul", roles: ["qa"], faq: "", customPrompt: "", trigger: "!AI", tone: "friendly", length: "normal", replyLocale: "ko", modelId: "default", dailyLimit: 100 });
const join = { url: "", roomLabel: "테스트방", permissionConfirmed: true, noticeConfirmed: true };
let seq = 0;
const ev = (roomId: string, text: string, extra: Partial<NormalizedEvent> = {}): NormalizedEvent => {
  const messageId = `${run}-${++seq}`;
  return { schemaVersion: 1, eventId: `${GW}:${messageId}`, gatewayId: GW, roomId, senderId: "s1", messageId, text, receivedAt: new Date().toISOString(), isSelf: false, kind: "text", ...extra };
};
const err = async (p: Promise<unknown>) => p.then(() => "no-error", (e) => (e as { code?: string }).code ?? String(e));

async function readyBot(ws: string, name: string, key: string) {
  const bot = await createBot(ws, input(name), key, 3);
  await requestJoin(ws, bot.id, join);
  await resolveJoin(bot.id, "joined", operator, "테스트 승인");
  return bot;
}

afterAll(async () => {
  const db = adminDb();
  for (const ws of [A, B]) for (const c of ["bots", "promptVersions", "activities", "idempotencyKeys", "joinRequests", "pairingTokens", "roomBindings", "deliveries", "jobs", "auditLogs"]) {
    const s = await db.collection(c).where("workspaceId", "==", ws).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  for (const c of ["events", "pairingAttempts"]) {
    const s = await db.collection(c).where("__name__", ">=", encodeURIComponent(GW)).where("__name__", "<", encodeURIComponent(GW) + "~").get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
});

describe("room connection (real Firestore)", () => {
  it("운영자 승인 전에는 코드를 발급할 수 없다", async () => {
    const bot = await createBot(A, input("미승인"), `k-${run}-u`, 3);
    await requestJoin(A, bot.id, join);
    expect(await err(issuePairingCode(A, bot.id))).toBe("invalid_state");
  });

  it("B 는 A 의 봇에 입장요청·코드발급을 할 수 없다", async () => {
    const bot = await createBot(A, input("A봇"), `k-${run}-a`, 3);
    expect(await err(requestJoin(B, bot.id, join))).toBe("not_found");
  });

  it("같은 코드를 두 방에서 동시에 보내도 연결은 하나만 된다", async () => {
    const bot = await readyBot(A, "동시", `k-${run}-c`);
    const { code } = await issuePairingCode(A, bot.id);
    const [r1, r2] = await Promise.all([claimRoom({ gatewayId: GW, roomId: "9001", eventId: `${run}-x1` }, code), claimRoom({ gatewayId: GW, roomId: "9002", eventId: `${run}-x2` }, code)]);
    expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
    const bindings = await adminDb().collection("roomBindings").where("botId", "==", bot.id).get();
    expect(bindings.size).toBe(1);
    expect((await adminDb().collection("bots").doc(bot.id).get()).data()?.state).toBe("active");
  });

  it("이미 연결된 방은 다른 고객의 코드로 가져갈 수 없다", async () => {
    const botB = await readyBot(B, "B봇", `k-${run}-b`);
    const { code } = await issuePairingCode(B, botB.id);
    const r = await claimRoom({ gatewayId: GW, roomId: "9001", eventId: `${run}-x3` }, code);
    expect(r).toEqual({ ok: false, reason: "room_taken" });
  });

  it("만료된 코드·잘못된 코드는 거절", async () => {
    const bot = await createBot(B, input("만료"), `k-${run}-e`, 3).catch(() => null);
    expect(await claimRoom({ gatewayId: GW, roomId: "9100", eventId: `${run}-x4` }, "ABCD-EFGH")).toEqual({ ok: false, reason: "invalid_code" });
    if (bot) {
      await requestJoin(B, bot.id, join);
      await resolveJoin(bot.id, "joined", operator, "테스트 승인");
      const { code } = await issuePairingCode(B, bot.id);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))), (b) => b.toString(16).padStart(2, "0")).join("");
      await adminDb().collection("pairingTokens").doc(hash).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
      expect(await claimRoom({ gatewayId: GW, roomId: "9101", eventId: `${run}-x5` }, code)).toEqual({ ok: false, reason: "expired_code" });
    }
  });

  it("방 이벤트: 중복은 한 번만, 일반 대화·자기 메시지는 무시, 호출어는 job 1개", async () => {
    const e1 = ev("9001", "!AI 내일 날씨?");
    expect((await ingestEvent(e1)).outcome).toBe("queued");
    expect((await ingestEvent(e1)).outcome).toBe("duplicate");
    expect((await ingestEvent(ev("9001", "그냥 대화"))).outcome).toBe("ignored_no_trigger");
    expect((await ingestEvent(ev("9001", "!AI 나 자신", { isSelf: true }))).outcome).toBe("ignored_self");
    expect((await ingestEvent(ev("9999", "!AI 미연결 방"))).outcome).toBe("ignored_unbound");
    const jobs = await adminDb().collection("jobs").where("workspaceId", "==", A).get();
    expect(jobs.size).toBe(1);
  });

  it("일시정지한 봇의 방은 처리하지 않는다", async () => {
    const binding = (await adminDb().collection("roomBindings").doc(`${GW}__9001`).get()).data()!;
    const bot = (await adminDb().collection("bots").doc(binding.botId).get()).data()!;
    await setPaused(A, binding.botId, true, bot.version);
    expect((await ingestEvent(ev("9001", "!AI 멈춤 상태"))).outcome).toBe("ignored_unbound");
  });
});

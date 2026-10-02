import { FieldValue } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/lib/server/firebase-admin";
import { isLlmConfigured } from "@/lib/server/llm";
import { processJob } from "@/lib/server/runtime";

// 실제 Firestore + 실제 gpt-6-luna (짧은 질문 1회). 키가 없으면 건너뛴다.
const run = `rt${Date.now().toString(36)}`;
const WS = `ws_test_R_${run}`;
const BOT = `bot_${run}`;
const GW = "gw-test";
const ROOM = `55${Date.now()}`;
const db = () => adminDb();

async function job(id: string, question: string) {
  await db().collection("jobs").doc(id).set({ eventId: id, workspaceId: WS, botId: BOT, gatewayId: GW, roomId: ROOM, senderId: "s1", kind: "question", question, state: "queued", attempt: 0, createdAt: FieldValue.serverTimestamp() });
}

afterAll(async () => {
  for (const c of ["jobs", "deliveries", "conversationLogs", "usageDaily", "usageMonthly", "botUsageDaily", "bots", "roomBindings"]) {
    const s = await db().collection(c).where("workspaceId", "==", WS).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db().collection("system").doc("flags").set({ killSwitch: false }, { merge: true });
  for (const prefix of [`ws__${WS}__`, `room__${GW}__${ROOM}__`]) {
    const s = await db().collection("rateCounters").where("__name__", ">=", prefix).where("__name__", "<", `${prefix}~`).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
});

describe.skipIf(!isLlmConfigured())("runtime (real Firestore + gpt-6-luna)", () => {
  it("setup", async () => {
    await db().collection("bots").doc(BOT).set({ workspaceId: WS, name: "런타임 테스트", roles: ["qa"], tone: "concise", length: "short", replyLocale: "ko", customPrompt: "", faq: "", trigger: "!AI", modelId: "default", dailyLimit: 1, state: "active", version: 1, promptVersion: 1 });
    await db().collection("roomBindings").doc(`${GW}__${ROOM}`).set({ workspaceId: WS, botId: BOT, gatewayId: GW, roomId: ROOM, state: "connected", loggingPolicy: { retentionDays: 7 } });
  });

  it("같은 job 을 동시에 두 번 처리해도 답변·로그·과금은 한 번", async () => {
    await job(`${run}-1`, "1+1은?");
    const outcomes = await Promise.all([processJob(`${run}-1`), processJob(`${run}-1`)]);
    expect(outcomes.filter((o) => o === "answered")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "skipped")).toHaveLength(1);
    const logs = await db().collection("conversationLogs").where("workspaceId", "==", WS).get();
    expect(logs.size).toBe(1);
    const usage = (await db().collection("usageDaily").where("workspaceId", "==", WS).get()).docs[0].data();
    expect(usage.succeeded).toBe(1);
    expect(usage.reservedMicros).toBe(0);
  });

  it("봇 일일 한도(1회)를 넘으면 LLM 호출 없이 한도 안내", async () => {
    await job(`${run}-2`, "두 번째 질문");
    expect(await processJob(`${run}-2`)).toBe("limited");
    const d = (await db().collection("deliveries").doc(`${run}-2__reply`).get()).data();
    expect(d?.kind).toBe("limit");
  });

  it("kill switch 가 켜지면 처리하지 않는다", async () => {
    await db().collection("system").doc("flags").set({ killSwitch: true }, { merge: true });
    await job(`${run}-3`, "세 번째");
    expect(await processJob(`${run}-3`)).toBe("killed");
    await db().collection("system").doc("flags").set({ killSwitch: false }, { merge: true });
  });
});

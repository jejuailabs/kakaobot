import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/lib/server/firebase-admin";
import { cleanupExpired, sweepStaleJobs } from "@/lib/server/maintenance";

const run = `mt${Date.now().toString(36)}`;
const WS = `ws_test_M_${run}`;
const db = () => adminDb();

afterAll(async () => {
  for (const c of ["conversationLogs", "jobs", "bots"]) {
    const s = await db().collection(c).where("workspaceId", "==", WS).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
});

describe("maintenance (real Firestore)", () => {
  it("보관기간이 지난 대화 로그만 지운다", async () => {
    await db().collection("conversationLogs").doc(`${run}-old`).set({ workspaceId: WS, input: "old", expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await db().collection("conversationLogs").doc(`${run}-new`).set({ workspaceId: WS, input: "new", expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000) });
    const removed = await cleanupExpired();
    expect(removed.conversationLogs).toBeGreaterThanOrEqual(1);
    expect((await db().collection("conversationLogs").doc(`${run}-old`).get()).exists).toBe(false);
    expect((await db().collection("conversationLogs").doc(`${run}-new`).get()).exists).toBe(true);
  });

  it("1분 넘게 멈춘 job 을 다시 처리한다 (비활성 봇이면 LLM 없이 ignored)", async () => {
    await db().collection("bots").doc(`${run}-bot`).set({ workspaceId: WS, state: "paused", name: "x" });
    await db().collection("jobs").doc(`${run}-job`).set({ workspaceId: WS, botId: `${run}-bot`, gatewayId: "gw-test", roomId: "1", senderId: "s", kind: "question", question: "q", state: "queued", attempt: 0, createdAt: Timestamp.fromMillis(Date.now() - 5 * 60_000) });
    await db().collection("jobs").doc(`${run}-fresh`).set({ workspaceId: WS, botId: `${run}-bot`, gatewayId: "gw-test", roomId: "1", senderId: "s", kind: "question", question: "q", state: "queued", attempt: 0, createdAt: FieldValue.serverTimestamp() });
    await sweepStaleJobs(20);
    expect((await db().collection("jobs").doc(`${run}-job`).get()).data()?.state).toBe("ignored");
    expect((await db().collection("jobs").doc(`${run}-fresh`).get()).data()?.state).toBe("queued");
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { createBot, deleteBot, getBot, listBots, setPaused, updateBot } from "@/lib/server/bots";
import { deleteDraft, getDraft, saveDraft } from "@/lib/server/drafts";
import { adminDb } from "@/lib/server/firebase-admin";

const run = `it${Date.now().toString(36)}`;
const A = `ws_test_A_${run}`;
const B = `ws_test_B_${run}`;

const input = (name: string) => ({
  name, description: "", roomUrl: "", locale: "ko", timezone: "Asia/Seoul", roles: ["qa"], faq: "", customPrompt: "v1 prompt",
  trigger: "!AI", tone: "friendly", length: "normal", replyLocale: "ko", modelId: "default", dailyLimit: 100,
});

const errCode = async (p: Promise<unknown>) => {
  try {
    await p;
    return "no-error";
  } catch (e) {
    return (e as { code?: string; status?: number }).code ?? String(e);
  }
};

afterAll(async () => {
  const db = adminDb();
  for (const ws of [A, B]) {
    for (const col of ["bots", "promptVersions", "activities", "idempotencyKeys", "wizardDrafts", "opsRequests"]) {
      const snap = await db.collection(col).where("workspaceId", "==", ws).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
  }
});

describe("bot CRUD + workspace isolation (real Firestore)", () => {
  let botA = "";

  it("A 가 만든 챗봇은 A 목록에만 있다", async () => {
    const bot = await createBot(A, input("A의 봇"), `key-${run}-1`, 3);
    botA = bot.id;
    expect((await listBots(A)).map((b) => b.id)).toContain(botA);
    expect((await listBots(B)).map((b) => b.id)).not.toContain(botA);
  });

  it("B 는 A 의 챗봇을 조회·수정·일시정지·삭제할 수 없다 (404)", async () => {
    expect(await errCode(getBot(B, botA))).toBe("not_found");
    expect(await errCode(updateBot(B, botA, { name: "탈취" }, 1))).toBe("not_found");
    expect(await errCode(setPaused(B, botA, true, 1))).toBe("not_found");
    expect(await errCode(deleteBot(B, botA))).toBe("not_found");
    expect((await getBot(A, botA)).name).toBe("A의 봇");
  });

  it("같은 Idempotency-Key 재시도는 챗봇을 하나만 만든다 (동시 요청 포함)", async () => {
    const key = `key-${run}-dup`;
    const [x, y] = await Promise.all([createBot(A, input("중복"), key, 3), createBot(A, input("중복"), key, 3)]);
    expect(x.id).toBe(y.id);
    expect((await listBots(A)).filter((b) => b.name === "중복")).toHaveLength(1);
  });

  it("다른 workspace 가 같은 key 를 써도 서로 영향이 없다", async () => {
    const b = await createBot(B, input("B의 봇"), `key-${run}-dup`, 3);
    expect((await listBots(B)).map((x) => x.id)).toEqual([b.id]);
  });

  it("버전이 다르면 409 conflict, 프롬프트가 바뀌면 새 버전", async () => {
    const updated = await updateBot(A, botA, { customPrompt: "v2 prompt" }, 1);
    expect(updated.version).toBe(2);
    expect(updated.promptVersion).toBe(2);
    expect(await errCode(updateBot(A, botA, { name: "늦은 저장" }, 1))).toBe("conflict");
  });

  it("한도(3개)를 넘으면 limit", async () => {
    await createBot(A, input("세번째"), `key-${run}-3`, 3);
    expect(await errCode(createBot(A, input("네번째"), `key-${run}-4`, 3))).toBe("limit");
  });

  it("연결 전(draft) 상태는 일시정지할 수 없다", async () => {
    expect(await errCode(setPaused(A, botA, true, 2))).toBe("invalid_state");
  });

  it("검증 실패는 validation (호출어 공백)", async () => {
    expect(await errCode(updateBot(A, botA, { trigger: "! AI" }, 2))).toBe("validation");
  });

  it("wizard draft 도 workspace 별로 격리된다", async () => {
    const id = `draft-${run}`;
    await saveDraft(A, id, { step: 2, values: { name: "임시" } });
    expect((await getDraft(A, id)).step).toBe(2);
    expect(await errCode(getDraft(B, id))).toBe("not_found");
    await deleteDraft(A, id);
    expect(await errCode(getDraft(A, id))).toBe("not_found");
  });

  it("삭제 후에는 목록·조회에서 사라진다", async () => {
    await deleteBot(A, botA);
    expect(await errCode(getBot(A, botA))).toBe("not_found");
    expect((await listBots(A)).map((b) => b.id)).not.toContain(botA);
  });
});

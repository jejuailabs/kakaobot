import { Timestamp } from "firebase-admin/firestore";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { GenOptions } from "@/lib/shared/appearance-gen";

// AI 배경 생성 job (docs/07). OpenAI 호출만 가짜로 바꾸고 Firestore·Storage 는 실제(테스트 전용 site 문서)로 검증한다.
// 실제 provider 호출은 비용이 들어 여기서는 하지 않는다 (실호출 확인은 docs/08 기록 참고).
const SITE = `test_gen_${Date.now().toString(36)}`;
process.env.APPEARANCE_SITE_DOC = SITE;
process.env.LLM_PROVIDER = "openai";
process.env.LLM_PROVIDER_API_KEY ??= "sk-test";

const actor = { uid: "test-gen-designer", roles: ["designer"] };
const opts: GenOptions = { theme: "dark", scene: "lake", palette: "lavender", season: "any", custom: "" };
const month = new Date().toISOString().slice(0, 7);

let mod: typeof import("@/lib/server/appearance");
let db: ReturnType<(typeof import("@/lib/server/firebase-admin"))["adminDb"]>;
let bucket: ReturnType<(typeof import("@/lib/server/firebase-admin"))["adminBucket"]>;
let png: string;
const realFetch = globalThis.fetch;
let openaiCalls = 0;
let script: (() => Promise<Response>)[] = [];
let passthrough = false;

function ok() {
  return new Response(JSON.stringify({ data: [{ b64_json: png }], usage: { input_tokens: 47, output_tokens: 157 } }), { status: 200, headers: { "x-request-id": "req_test" } });
}
const rid = () => `t${Math.random().toString(36).slice(2, 12)}`;

beforeAll(async () => {
  mod = await import("@/lib/server/appearance");
  const fa = await import("@/lib/server/firebase-admin");
  db = fa.adminDb();
  bucket = fa.adminBucket();
  png = (await sharp({ create: { width: 2048, height: 1152, channels: 3, background: { r: 60, g: 110, b: 150 } } }).webp().toBuffer()).toString("base64");
  // api.openai.com 만 가로챈다 (Storage 등 다른 요청은 그대로)
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith("https://api.openai.com/")) {
      openaiCalls++;
      if (passthrough) return realFetch(input, init);
      const next = script.shift();
      if (!next) throw new Error("unexpected provider call");
      return next();
    }
    return realFetch(input, init);
  });
});

afterEach(() => {
  openaiCalls = 0;
  script = [];
  delete process.env.IMAGE_MONTHLY_BUDGET_USD;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  const jobs = await db.collection("backgroundJobs").where("site", "==", SITE).get();
  for (const j of jobs.docs) {
    const assetId = j.data().assetId as string | undefined;
    if (assetId) {
      await db.collection("backgroundAssets").doc(assetId).delete();
      await Promise.all(["desktop", "mobile", "thumb"].map((v) => bucket.file(`backgrounds/${assetId}/${v}.webp`).delete({ ignoreNotFound: true })));
    }
    await j.ref.delete();
  }
  await db.collection("imageUsageMonthly").doc(`${SITE}_${month}`).delete();
  await db.collection("appearanceGenLocks").doc(SITE).delete();
  const audits = await db.collection("auditLogs").where("actorUid", "==", actor.uid).get();
  await Promise.all(audits.docs.map((d) => d.ref.delete()));
});

const usage = async () => (await db.collection("imageUsageMonthly").doc(`${SITE}_${month}`).get()).data() ?? {};

describe("AI background generation job (real Firestore/Storage, mocked provider)", () => {
  it("성공: AI draft asset 생성·실제 usage 로 비용 정산·lock 해제, 같은 requestId 재요청은 같은 job", async () => {
    script = [async () => ok()];
    const id = rid();
    const job = await mod.generateBackground(actor, id, opts);
    expect(job.status).toBe("ready");
    expect(job.costMicros).toBe(47 * 5 + 157 * 30);
    const asset = (await db.collection("backgroundAssets").doc(job.assetId!).get()).data()!;
    expect(asset).toMatchObject({ source: "ai", state: "draft", theme: "dark", model: "gpt-image-2.5-flare", width: 2048 });
    expect(asset.prompt).toContain("No text");
    expect((await mod.readAssetFile(job.assetId!, "desktop"))?.published).toBe(false);
    expect((await db.collection("appearanceGenLocks").doc(SITE).get()).exists).toBe(false);
    expect(await usage()).toMatchObject({ count: 1, costMicros: 4945, reservedMicros: 0 });

    const again = await mod.generateBackground(actor, id, opts);
    expect(again).toMatchObject({ id, status: "ready", assetId: job.assetId });
    expect(openaiCalls).toBe(1);
  });

  it("5xx 는 1 회만 재시도, 4xx 는 재시도 없이 실패·비용 0", async () => {
    script = [async () => new Response("{}", { status: 500 }), async () => ok()];
    expect((await mod.generateBackground(actor, rid(), opts)).status).toBe("ready");
    expect(openaiCalls).toBe(2);

    openaiCalls = 0;
    script = [async () => new Response(JSON.stringify({ error: { message: "bad", code: "moderation_blocked" } }), { status: 400 })];
    const bad = await mod.generateBackground(actor, rid(), opts);
    expect(bad).toMatchObject({ status: "failed", error: "moderation", costMicros: 0 });
    expect(openaiCalls).toBe(1);

    openaiCalls = 0;
    script = [async () => new Response("{}", { status: 503 }), async () => new Response("{}", { status: 503 }), async () => ok()];
    expect((await mod.generateBackground(actor, rid(), opts)).status).toBe("failed");
    expect(openaiCalls).toBe(2);
  });

  it("결과 불명(timeout·연결 끊김)은 재시도하지 않고 예약액을 비용으로 확정", async () => {
    const before = (await usage()).costMicros as number;
    script = [async () => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" })), async () => ok()];
    const job = await mod.generateBackground(actor, rid(), opts);
    expect(job).toMatchObject({ status: "failed", error: "unknown", costMicros: 50_000 });
    expect(openaiCalls).toBe(1);
    expect(((await usage()).costMicros as number) - before).toBe(50_000);
    expect((await usage()).reservedMicros).toBe(0);
  });

  it("동시에 1 job: 진행 중 lock 이면 409, 오래된 lock 은 불명 실패로 정리 후 진행", async () => {
    const stuck = rid();
    await db.collection("backgroundJobs").doc(stuck).set({ site: SITE, status: "generating", theme: "dark", label: "stuck", month, reservedMicros: 50_000, startedAt: Timestamp.now(), createdAt: Timestamp.now() });
    await db.collection("appearanceGenLocks").doc(SITE).set({ activeJobId: stuck });
    await db.collection("imageUsageMonthly").doc(`${SITE}_${month}`).set({ reservedMicros: 50_000 }, { merge: true });
    await expect(mod.generateBackground(actor, rid(), opts)).rejects.toMatchObject({ status: 409, messageKey: "admin.appearance.genBusy" });
    expect(openaiCalls).toBe(0);

    await db.collection("backgroundJobs").doc(stuck).update({ startedAt: Timestamp.fromMillis(Date.now() - 10 * 60_000) });
    script = [async () => ok()];
    expect((await mod.generateBackground(actor, rid(), opts)).status).toBe("ready");
    expect((await db.collection("backgroundJobs").doc(stuck).get()).data()).toMatchObject({ status: "failed", error: "unknown", costMicros: 50_000 });
    expect((await usage()).reservedMicros).toBe(0);
  });

  it("월 예산을 넘으면 provider 를 부르지 않고 429", async () => {
    process.env.IMAGE_MONTHLY_BUDGET_USD = "0.05";
    await expect(mod.generateBackground(actor, rid(), opts)).rejects.toMatchObject({ status: 429, messageKey: "admin.appearance.genBudget" });
    expect(openaiCalls).toBe(0);
    expect((await db.collection("appearanceGenLocks").doc(SITE).get()).exists).toBe(false);
  });

  it("상태 요약은 이 site 의 job 과 이번 달 비용만", async () => {
    const s = await mod.generationStatus();
    expect(s).toMatchObject({ configured: true, model: "gpt-image-2.5-flare", quality: "low" });
    expect(s.jobs.length).toBeGreaterThan(0);
    expect(s.monthCount).toBe((await usage()).count);
  });

  // 실제 OpenAI 호출(약 $0.005). 기본 실행에서는 건너뛰고 LIVE_IMAGE_TEST=1 일 때만.
  it.runIf(process.env.LIVE_IMAGE_TEST === "1")("실제 provider: low 품질 1장 → draft asset·실제 usage 비용", async () => {
    passthrough = true;
    try {
      const job = await mod.generateBackground(actor, rid(), { theme: "light", scene: "mountain", palette: "teal", season: "spring", custom: "" });
      expect(job.status).toBe("ready");
      expect(job.costMicros).toBeGreaterThan(0);
      expect(job.costMicros).toBeLessThan(50_000);
      const asset = (await db.collection("backgroundAssets").doc(job.assetId!).get()).data()!;
      process.stderr.write(`live image job ${JSON.stringify({ costMicros: job.costMicros, width: asset.width, sizeKb: asset.sizeKb, luminance: asset.luminance })}\n`);
      expect(asset.width).toBeGreaterThanOrEqual(1600);
    } finally {
      passthrough = false;
    }
  }, 180_000);
});

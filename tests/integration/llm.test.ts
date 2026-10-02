import { describe, expect, it } from "vitest";
import { costMicros, generate, isLlmConfigured, MODELS } from "@/lib/server/llm";
import { buildMessages, buildSystemPrompt } from "@/lib/shared/prompt";

// 실제 OpenAI 호출 (아주 짧은 질문, 비용 수 원 미만). 키가 없으면 건너뛴다.
describe.skipIf(!isLlmConfigured())("gpt-6-luna live call", () => {
  it("한국어 답변·토큰·비용이 돌아온다", async () => {
    const model = MODELS["gpt-6-luna"];
    const system = buildSystemPrompt({ name: "테스트 봇", roles: ["qa"], tone: "friendly", length: "short", replyLocale: "ko", customPrompt: "", faq: "" });
    const started = Date.now();
    const out = await generate({ model, system, messages: buildMessages([], "제주도에서 가볼 만한 바다 한 곳만 추천해 줘"), maxOutputTokens: 1200, timeoutMs: 25_000, requestId: `it_${Date.now()}` });
    const ms = Date.now() - started;
    console.log(`[llm] ${ms}ms in=${out.inputTokens} out=${out.outputTokens} cost=${costMicros(model, out.inputTokens, out.outputTokens, out.cachedInputTokens)}µ$ truncated=${out.truncated}\n${out.text}`);
    expect(out.text.length).toBeGreaterThan(5);
    expect(/[가-힣]/.test(out.text)).toBe(true);
    expect(out.inputTokens).toBeGreaterThan(0);
    expect(out.outputTokens).toBeGreaterThan(0);
  });
});

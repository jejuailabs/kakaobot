import { describe, expect, it } from "vitest";
import { buildMessages, buildSystemPrompt, finalizeReply, redactSecrets, REPLY_MAX_CHARS } from "@/lib/shared/prompt";

const base = { name: "봇", roles: ["qa"] as const, tone: "friendly" as const, length: "short" as const, replyLocale: "ko" as const, customPrompt: "비밀 지시", faq: "Q: 장소? A: 강남" };

describe("prompt", () => {
  it("custom·FAQ 는 해당 역할을 고른 경우에만 들어간다", () => {
    const qa = buildSystemPrompt({ ...base, roles: ["qa"] });
    expect(qa).not.toContain("비밀 지시");
    expect(qa).not.toContain("강남");
    const all = buildSystemPrompt({ ...base, roles: ["qa", "custom", "faq"] });
    expect(all).toContain("비밀 지시");
    expect(all).toContain("강남");
  });
  it("최근 6왕복만 넣고 마지막은 질문", () => {
    const h = Array.from({ length: 9 }, (_, i) => ({ input: `q${i}`, output: `a${i}` }));
    const m = buildMessages(h, "지금 질문");
    expect(m).toHaveLength(13);
    expect(m[0].content).toBe("q3");
    expect(m.at(-1)).toEqual({ role: "user", content: "지금 질문" });
  });
  it("답변은 1,200자 이내, 마크다운 제목·굵게 제거", () => {
    expect(finalizeReply("## 제목\n**굵게** 본문")).toBe("제목\n굵게 본문");
    expect(finalizeReply("가".repeat(2000)).length).toBe(REPLY_MAX_CHARS);
  });
  it("로그에서 API 키·연결 코드 제거", () => {
    expect(redactSecrets("키 sk-proj-abcdefghijklmnopqrstuv 노출")).toBe("키 [redacted-key] 노출");
    expect(redactSecrets("!연결 ABCD-EFGH")).toBe("!연결 [redacted-code]");
  });
});

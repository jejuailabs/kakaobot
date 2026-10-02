import { describe, expect, it } from "vitest";
import { csvCell, maskText } from "@/lib/shared/masking";
import { generatePairingCode, PAIRING_CODE_PATTERN, parseConnectCommand } from "@/lib/shared/pairing";
import { safeNextPath } from "@/lib/shared/redirect";
import { botInputSchema, isSupportedOpenChatUrl, rolesSchema } from "@/lib/shared/schemas";
import { matchTrigger } from "@/lib/shared/trigger";

describe("matchTrigger", () => {
  it("선두 일치 + 영문 대소문자 무시", () => {
    expect(matchTrigger("!ai 제주 날씨", "!AI")).toEqual({ kind: "question", question: "제주 날씨" });
    expect(matchTrigger("  !AI   hi ", "!AI")).toEqual({ kind: "question", question: "hi" });
  });
  it("빈 질문은 도움말, 일반 대화는 무시", () => {
    expect(matchTrigger("!AI", "!AI")).toEqual({ kind: "help" });
    expect(matchTrigger("오늘 !AI 어때", "!AI")).toEqual({ kind: "none" });
    expect(matchTrigger("!AIabc", "!AI")).toEqual({ kind: "none" });
  });
  it("4,000자 초과는 거절", () => {
    expect(matchTrigger(`!AI ${"가".repeat(4001)}`, "!AI")).toEqual({ kind: "tooLong" });
  });
});

describe("pairing code", () => {
  it("8자리 Base32 형식, 매번 다름", () => {
    const codes = new Set(Array.from({ length: 200 }, generatePairingCode));
    for (const c of codes) expect(c).toMatch(PAIRING_CODE_PATTERN);
    expect(codes.size).toBe(200);
  });
  it("방 명령 파싱", () => {
    expect(parseConnectCommand("!연결 abcd-efgh")).toBe("ABCD-EFGH");
    expect(parseConnectCommand("!connect ABCD-EFGH")).toBe("ABCD-EFGH");
    expect(parseConnectCommand("!연결 ABCD-EFG0")).toBeNull(); // 0 은 alphabet 밖
    expect(parseConnectCommand("안녕 !연결 ABCD-EFGH")).toBeNull();
  });
});

describe("masking / csv", () => {
  it("전화·이메일·긴 숫자 마스킹", () => {
    expect(maskText("010-1234-5678 로 연락")).toBe("010-****-5678 로 연락");
    expect(maskText("mail a.b@x.com now")).toBe("mail •••@••• now");
    expect(maskText("계좌 1234567890")).toBe("계좌 ••••••••••");
  });
  it("formula injection 무력화", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("평범")).toBe("평범");
  });
});

describe("validation", () => {
  it("오픈채팅 URL host 제한", () => {
    expect(isSupportedOpenChatUrl("https://open.kakao.com/o/gAbC123")).toBe(true);
    expect(isSupportedOpenChatUrl("http://open.kakao.com/o/gAbC123")).toBe(false);
    expect(isSupportedOpenChatUrl("https://evil.com/o/x")).toBe(false);
    expect(isSupportedOpenChatUrl("https://open.kakao.com.evil.com/o/x")).toBe(false);
  });
  it("역할 1~3개, FAQ 선택 시 필수", () => {
    expect(rolesSchema.safeParse({ roles: [], faq: "", customPrompt: "" }).success).toBe(false);
    expect(rolesSchema.safeParse({ roles: ["qa", "faq", "notice", "custom"], faq: "x", customPrompt: "y" }).success).toBe(false);
    expect(rolesSchema.safeParse({ roles: ["faq"], faq: "", customPrompt: "" }).success).toBe(false);
    expect(rolesSchema.safeParse({ roles: ["qa"], faq: "", customPrompt: "" }).success).toBe(true);
  });
  it("호출어 공백 금지", () => {
    const base = { name: "봇이름", description: "", roomUrl: "", locale: "ko", timezone: "Asia/Seoul", roles: ["qa"], faq: "", customPrompt: "", tone: "friendly", length: "normal", replyLocale: "ko", modelId: "m", dailyLimit: 100 };
    expect(botInputSchema.safeParse({ ...base, trigger: "!AI" }).success).toBe(true);
    expect(botInputSchema.safeParse({ ...base, trigger: "! AI" }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("외부 redirect 차단", () => {
    expect(safeNextPath("/ko/bots?x=1")).toBe("/ko/bots?x=1");
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(safeNextPath("/ok\nSet-Cookie")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});

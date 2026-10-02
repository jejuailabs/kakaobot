// ⚠ DEMO 전용 데이터. 실제 KPI·회원·대화가 아니다. /demo 경로에서만 사용한다.
// 시안 03 의 이름·숫자(12,430 / 96% 등)를 재현한 예시값이며 운영 화면에 주입하지 않는다.

import type { Activity, Bot, ConsoleSnapshot, PromptVersion, Room, UsageDay } from "./domain";

const DAY = 86_400_000;

function iso(offsetMs: number, now: number) {
  return new Date(now + offsetMs).toISOString();
}

/** 결정적 30 일 사용량: 합계가 약 12,430 이 되도록 생성 */
export function demoUsage(now: number, days = 90): UsageDay[] {
  const out: UsageDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const date = d.toISOString().slice(0, 10);
    const wave = Math.sin((days - i) / 3.2) * 70 + Math.sin((days - i) / 9) * 50;
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? 60 : 0;
    const requests = Math.max(120, Math.round(395 + wave + weekend + ((days - i) % 5) * 6));
    const failed = Math.round(requests * (0.03 + ((days - i) % 4) * 0.004));
    out.push({ date, requests, succeeded: requests - failed, failed });
  }
  return out;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  travel:
    "너는 친절한 여행 플래너야. 방 참여자의 질문에 일정·맛집·이동 경로를 짧고 정확하게 정리해 줘. 모르는 정보는 추측하지 말고 확인이 필요하다고 말해.",
  family: "가족 단톡방 도우미. 일정 정리와 생활 정보를 따뜻한 말투로 간결하게 답한다.",
  marketing: "마케팅 팀 비서. 공지 초안과 회의 요약을 전문적인 톤으로 작성한다.",
  study: "스터디 도우미. 학습 질문에 단계별로 설명한다.",
};

export function demoSnapshot(now = Date.now()): ConsoleSnapshot {
  const base = {
    description: "",
    roomUrl: "",
    locale: "ko" as const,
    timezone: "Asia/Seoul",
    faq: "",
    customPrompt: "",
    trigger: "!AI",
    replyLocale: "ko" as const,
    modelId: "demo-standard",
    dailyLimit: 100,
    createdAt: iso(-40 * DAY, now),
  };

  const bots: Bot[] = [
    {
      ...base,
      id: "demo-travel",
      name: "여행 플래너",
      description: "주말 여행 일정과 맛집을 정리해 주는 도우미",
      roles: ["qa", "custom"],
      customPrompt: SYSTEM_PROMPTS.travel,
      tone: "friendly",
      length: "normal",
      state: "active",
      version: 4,
      promptVersion: 3,
      roomLabel: "여행 메이트",
      messages30d: 5210,
      updatedAt: iso(-2 * 3_600_000, now),
    },
    {
      ...base,
      id: "demo-family",
      name: "우리 가족 도우미",
      description: "가족 일정과 생활 정보를 챙겨요",
      roles: ["qa", "faq"],
      faq: "Q: 이번 달 가족 모임은?\nA: 셋째 주 토요일 저녁 6시, 할머니 댁입니다.\nQ: 분리수거 요일은?\nA: 화요일·금요일 저녁입니다.",
      customPrompt: SYSTEM_PROMPTS.family,
      tone: "friendly",
      length: "short",
      state: "active",
      version: 2,
      promptVersion: 1,
      roomLabel: "우리 가족",
      messages30d: 3980,
      updatedAt: iso(-1 * DAY, now),
    },
    {
      ...base,
      id: "demo-marketing",
      name: "마케팅 팀 비서",
      description: "공지 초안과 회의 메모 정리",
      roles: ["notice", "qa"],
      customPrompt: SYSTEM_PROMPTS.marketing,
      tone: "professional",
      length: "detailed",
      trigger: "!비서",
      state: "active",
      version: 3,
      promptVersion: 2,
      roomLabel: "마케팅 팀",
      messages30d: 3240,
      updatedAt: iso(-3 * DAY, now),
    },
    {
      ...base,
      id: "demo-study",
      name: "스터디 도우미",
      description: "수학·영어 스터디방 질문 답변",
      roles: ["qa"],
      tone: "concise",
      length: "normal",
      state: "awaiting_code",
      version: 1,
      promptVersion: 1,
      roomLabel: null,
      messages30d: 0,
      updatedAt: iso(-20 * 60_000, now),
    },
  ];

  const rooms: Room[] = [
    { id: "demo-room-1", botId: "demo-travel", label: "여행 메이트", state: "connected", lastMessageAt: iso(-4 * 60_000, now), messages7d: 1204, retentionDays: 30 },
    { id: "demo-room-2", botId: "demo-family", label: "우리 가족", state: "connected", lastMessageAt: iso(-52 * 60_000, now), messages7d: 918, retentionDays: 30 },
    { id: "demo-room-3", botId: "demo-marketing", label: "마케팅 팀", state: "connected", lastMessageAt: iso(-5 * 3_600_000, now), messages7d: 760, retentionDays: 7 },
  ];

  const prompts: PromptVersion[] = bots.flatMap((b) =>
    Array.from({ length: b.promptVersion }, (_, i) => ({
      id: `${b.id}-p${i + 1}`,
      botId: b.id,
      version: i + 1,
      body: i + 1 === b.promptVersion ? b.customPrompt : `${b.customPrompt.slice(0, 40)}… (v${i + 1})`,
      faq: b.faq,
      createdAt: iso(-(b.promptVersion - i) * 5 * DAY, now),
    })),
  );

  const activities: Activity[] = [
    { id: "a1", kind: "connected", botId: "demo-travel", botName: "여행 플래너", at: iso(-2 * 3_600_000, now) },
    { id: "a2", kind: "settings", botId: "demo-marketing", botName: "마케팅 팀 비서", at: iso(-18 * 3_600_000, now) },
    { id: "a3", kind: "failed", botId: "demo-family", botName: "우리 가족 도우미", at: iso(-26 * 3_600_000, now) },
    { id: "a4", kind: "settings", botId: "demo-travel", botName: "여행 플래너", at: iso(-3 * DAY, now) },
  ];

  return {
    user: { displayName: "민지", email: "minji@demo.katcha" },
    bots,
    rooms,
    joinRequests: [
      {
        id: "demo-jr-1",
        botId: "demo-study",
        url: "https://open.kakao.com/o/demoStudy",
        roomLabel: "수학 스터디",
        permissionConfirmed: true,
        noticeConfirmed: true,
        state: "awaiting_code",
        rejectReasonKey: null,
        createdAt: iso(-3 * 3_600_000, now),
      },
    ],
    pairingCodes: [],
    prompts,
    usage: demoUsage(now),
    activities,
    gateway: { health: "online", lastCheckedAt: iso(-30_000, now) },
    models: [
      { id: "demo-standard", label: "Standard (demo)", provider: "demo", configured: true },
      { id: "demo-fast", label: "Fast (demo)", provider: "demo", configured: true },
    ],
    searchConfigured: false,
    limits: { maxBots: 5 },
  };
}

/** demo 테스트 답변. 실제 LLM 호출이 아니다. */
export function demoReply(question: string, botName: string, locale: string): string {
  if (locale === "en") return `(${botName}) This is a demo answer. A real model will reply here after an API key is configured. — "${question.slice(0, 60)}"`;
  if (locale === "ja") return `(${botName}) これはデモ回答です。APIキー設定後に実際のモデルが回答します。— 「${question.slice(0, 60)}」`;
  return `(${botName}) 데모 답변입니다. API 키를 설정하면 실제 모델이 답합니다. — “${question.slice(0, 60)}”`;
}

// ⚠ DEMO 전용 운영자 데이터. 실제 회원·대화·비용이 아니다.

const DAY = 86_400_000;
const iso = (now: number, ms: number) => new Date(now - ms).toISOString();

export type MemberStatus = "active" | "suspended" | "deleting";
export type DemoMember = {
  uid: string;
  displayName: string;
  email: string;
  joinedAt: string;
  lastSeenAt: string;
  bots: number;
  rooms: number;
  monthRequests: number;
  monthCostMicros: number;
  status: MemberStatus;
  dailyLimit: number;
};

export type ConversationStatus = "answered" | "failed" | "unknown_delivery";
export type DemoConversation = {
  id: string;
  requestId: string;
  workspace: string;
  bot: string;
  room: string;
  model: string;
  promptVersion: number;
  status: ConversationStatus;
  latencyMs: number;
  tokens: number;
  costMicros: number;
  at: string;
  input: string;
  output: string;
  errorCode: string | null;
};

export type DemoAudit = { id: string; actor: string; role: string; action: string; target: string; reason: string; at: string };
export type DemoJob = { id: string; kind: "ai" | "background"; state: "failed" | "dead_letter" | "unknown"; errorCode: string; attempt: number; at: string; target: string };
export type DemoGateway = { id: string; label: string; health: "online" | "degraded" | "offline"; lastHeartbeat: string; adapterVersion: string; rooms: number; queueDepth: number };
export type DemoAsset = { id: string; source: "builtin" | "upload" | "ai"; label: string; theme: "light" | "dark"; state: "active" | "draft" | "previous"; url: string; createdAt: string; sizeKb: number; width: number };
export type DemoJoinQueueItem = { id: string; workspace: string; roomLabel: string; url: string; state: "pending" | "awaiting_code" | "rejected"; at: string };

const NAMES = ["민지", "서준", "Hana", "지우", "Kenji", "도윤", "Emily", "하린", "유나", "Riku", "건우", "소율"];

export function demoAdmin(now = Date.now()) {
  const members: DemoMember[] = NAMES.map((n, i) => ({
    uid: `demo-u${String(i + 1).padStart(3, "0")}`,
    displayName: n,
    email: `${["minji", "seojun", "hana", "jiwoo", "kenji", "doyun", "emily", "harin", "yuna", "riku", "gunwoo", "soyul"][i]}@demo.katcha`,
    joinedAt: iso(now, (60 - i * 4) * DAY),
    lastSeenAt: iso(now, (i % 5) * 3_600_000 + i * 60_000),
    bots: (i % 3) + 1,
    rooms: i % 3,
    monthRequests: 2400 - i * 170,
    monthCostMicros: (2400 - i * 170) * 380,
    status: i === 6 ? "suspended" : i === 11 ? "deleting" : "active",
    dailyLimit: 100,
  }));

  const conv = [
    ["제주 2박 3일 일정 짜줘", "1일차 동문시장·용두암, 2일차 성산일출봉·섭지코지, 3일차 협재해변을 추천해요. 이동은 렌터카 기준이에요."],
    ["이번 주 회의 내용 요약해줘", "주요 결정: 캠페인 일정 확정(다음 주 화), 담당: 마케팅팀. 후속: 예산안 금요일까지 공유."],
    ["분리수거 언제야?", "화요일·금요일 저녁입니다."],
    ["오늘 저녁 메뉴 추천", "가벼운 메뉴로 비빔국수나 두부조림 어떠세요?"],
    ["010-1234-5678 로 연락 달라고 공지 써줘", "[공지] 문의는 담당자 연락처(010-****-5678)로 부탁드립니다."],
  ];
  const conversations: DemoConversation[] = Array.from({ length: 18 }, (_, i) => {
    const [input, output] = conv[i % conv.length];
    const status: ConversationStatus = i === 3 ? "failed" : i === 7 ? "unknown_delivery" : "answered";
    return {
      id: `demo-c${i + 1}`,
      requestId: `req_${(9000 + i * 37).toString(36)}`,
      workspace: members[i % 6].displayName,
      bot: ["여행 플래너", "마케팅 팀 비서", "우리 가족 도우미"][i % 3],
      room: ["여행 메이트", "마케팅 팀", "우리 가족"][i % 3],
      model: i % 4 === 0 ? "Fast (demo)" : "Standard (demo)",
      promptVersion: (i % 3) + 1,
      status,
      latencyMs: 900 + ((i * 337) % 2600),
      tokens: 380 + ((i * 97) % 900),
      costMicros: 140 + ((i * 53) % 600),
      at: iso(now, i * 47 * 60_000),
      input,
      output: status === "failed" ? "" : output,
      errorCode: status === "failed" ? "provider_429" : status === "unknown_delivery" ? "delivery_timeout" : null,
    };
  });

  const audit: DemoAudit[] = [
    { id: "au1", actor: "ops-kim", role: "superadmin", action: "member.suspend", target: "demo-u007", reason: "스팸 신고 3건 확인", at: iso(now, 2 * 3_600_000) },
    { id: "au2", actor: "support-lee", role: "support", action: "conversation.reveal", target: "demo-c4", reason: "고객 문의 #1182 답변 실패 확인", at: iso(now, 5 * 3_600_000) },
    { id: "au3", actor: "design-park", role: "designer", action: "appearance.publish", target: "bg-v12 (dark)", reason: "가을 시즌 배경", at: iso(now, 1 * DAY) },
    { id: "au4", actor: "ops-kim", role: "superadmin", action: "member.limit", target: "demo-u002", reason: "베타 테스트 한도 상향", at: iso(now, 2 * DAY) },
    { id: "au5", actor: "ops-kim", role: "superadmin", action: "room.unbind", target: "gw-01/room-88", reason: "고객 요청 해제", at: iso(now, 3 * DAY) },
    { id: "au6", actor: "support-lee", role: "support", action: "conversation.export", target: "7d · 120건", reason: "장애 분석", at: iso(now, 4 * DAY) },
  ];

  const jobs: DemoJob[] = [
    { id: "job_a1", kind: "ai", state: "failed", errorCode: "provider_429", attempt: 3, at: iso(now, 40 * 60_000), target: "evt gw-01:8812" },
    { id: "job_a2", kind: "ai", state: "unknown", errorCode: "delivery_timeout", attempt: 1, at: iso(now, 3 * 3_600_000), target: "dlv_3391" },
    { id: "job_b1", kind: "background", state: "failed", errorCode: "contrast_check_failed", attempt: 1, at: iso(now, 1 * DAY), target: "gen_0921" },
    { id: "job_a3", kind: "ai", state: "dead_letter", errorCode: "invalid_binding", attempt: 3, at: iso(now, 2 * DAY), target: "evt gw-01:7710" },
  ];

  const gateways: DemoGateway[] = [{ id: "gw-01", label: "Oracle A1 · Seoul (demo)", health: "online", lastHeartbeat: iso(now, 22_000), adapterVersion: "relay 0.1.0 / iris (unverified)", rooms: 3, queueDepth: 0 }];

  const assets: DemoAsset[] = [
    { id: "builtin-dark", source: "builtin", label: "Lake Dusk", theme: "dark", state: "active", url: "/backgrounds/landscape-dark.webp", createdAt: iso(now, 30 * DAY), sizeKb: 22, width: 2560 },
    { id: "builtin-light", source: "builtin", label: "Lake Morning", theme: "light", state: "active", url: "/backgrounds/landscape-light.webp", createdAt: iso(now, 30 * DAY), sizeKb: 23, width: 2560 },
    { id: "prev-dark", source: "upload", label: "Lake Dusk (v11)", theme: "dark", state: "previous", url: "/backgrounds/landscape-dark.webp", createdAt: iso(now, 12 * DAY), sizeKb: 22, width: 2560 },
  ];

  const joinQueue: DemoJoinQueueItem[] = [
    { id: "q1", workspace: "서준", roomLabel: "독서 모임", url: "https://open.kakao.com/o/demoBook", state: "pending", at: iso(now, 25 * 60_000) },
    { id: "q2", workspace: "Hana", roomLabel: "Tokyo trip", url: "https://open.kakao.com/o/demoTokyo", state: "pending", at: iso(now, 3 * 3_600_000) },
  ];

  const signups = Array.from({ length: 30 }, (_, i) => ({ date: new Date(now - (29 - i) * DAY).toISOString().slice(0, 10), value: 2 + ((i * 7) % 6) }));

  return { members, conversations, audit, jobs, gateways, assets, joinQueue, signups, updatedAt: iso(now, 4 * 60_000) };
}

export type DemoAdminData = ReturnType<typeof demoAdmin>;

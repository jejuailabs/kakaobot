// 화면과 서버가 공유하는 도메인 타입. room/message ID 는 항상 문자열이다.

export const ROLE_IDS = ["qa", "faq", "notice", "search", "custom"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const TONES = ["friendly", "concise", "professional"] as const;
export type Tone = (typeof TONES)[number];

export const LENGTHS = ["short", "normal", "detailed"] as const;
export type ReplyLength = (typeof LENGTHS)[number];

export const REPLY_LOCALES = ["ko", "en", "ja"] as const;
export type ReplyLocale = (typeof REPLY_LOCALES)[number];

/** draft → (입장요청) awaiting_join → (운영자 입장 확인) awaiting_code → (코드 검증) active ⇄ paused */
export type BotState = "draft" | "awaiting_join" | "awaiting_code" | "active" | "paused";

export type Bot = {
  id: string;
  name: string;
  description: string;
  roomUrl: string;
  locale: ReplyLocale;
  timezone: string;
  roles: RoleId[];
  faq: string;
  customPrompt: string;
  trigger: string;
  tone: Tone;
  length: ReplyLength;
  replyLocale: ReplyLocale;
  modelId: string;
  dailyLimit: number;
  state: BotState;
  version: number;
  promptVersion: number;
  roomLabel: string | null;
  messages30d: number;
  createdAt: string;
  updatedAt: string;
};

export type RoomState = "connected" | "paused";

export type Room = {
  id: string;
  botId: string;
  label: string;
  state: RoomState;
  lastMessageAt: string | null;
  messages7d: number;
  retentionDays: 7 | 30 | 90;
};

export type JoinRequestState = "pending" | "awaiting_code" | "rejected" | "connected";

export type JoinRequest = {
  id: string;
  botId: string;
  url: string;
  roomLabel: string;
  permissionConfirmed: boolean;
  noticeConfirmed: boolean;
  state: JoinRequestState;
  rejectReasonKey: string | null;
  createdAt: string;
};

export type PairingCode = {
  botId: string;
  /** 화면 표시용 원문. 서버는 hash 만 저장한다. demo 에서만 원문을 메모리에 둔다. */
  code: string;
  expiresAt: string;
};

export type PromptVersion = {
  id: string;
  botId: string;
  version: number;
  body: string;
  faq: string;
  createdAt: string;
};

export type UsageDay = {
  date: string; // YYYY-MM-DD (UTC)
  requests: number;
  succeeded: number;
  failed: number;
};

export type ActivityKind = "connected" | "settings" | "failed";

export type Activity = {
  id: string;
  kind: ActivityKind;
  botId: string;
  botName: string;
  at: string;
};

export type GatewayHealth = "online" | "degraded" | "offline" | "unknown";

export type GatewayStatus = {
  health: GatewayHealth;
  lastCheckedAt: string | null;
};

export type ModelOption = {
  id: string;
  label: string;
  provider: string;
  configured: boolean;
};

export type ConsoleSnapshot = {
  user: { displayName: string; email: string };
  bots: Bot[];
  rooms: Room[];
  joinRequests: JoinRequest[];
  pairingCodes: PairingCode[];
  prompts: PromptVersion[];
  usage: UsageDay[];
  activities: Activity[];
  gateway: GatewayStatus;
  models: ModelOption[];
  searchConfigured: boolean;
  limits: { maxBots: number };
};

export const BOT_LIMITS = {
  nameMin: 2,
  nameMax: 40,
  descriptionMax: 200,
  faqMax: 12_000,
  customPromptMax: 8_000,
  rolesMin: 1,
  rolesMax: 3,
  maxBotsPerWorkspace: 3,
  pairingTtlMinutes: 10,
  questionMax: 4_000,
} as const;

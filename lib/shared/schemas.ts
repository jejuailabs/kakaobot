import { z } from "zod";
import { BOT_LIMITS, LENGTHS, REPLY_LOCALES, ROLE_IDS, TONES } from "./domain";

// 오류 메시지는 번역 key 로 둔다 (messages/*.json 의 validation.*).

const OPENCHAT_HOSTS = new Set(["open.kakao.com"]);

/** 오픈채팅 URL 형식만 검사한다. 서버가 자동 방문하거나 입장하지 않는다. */
export function isSupportedOpenChatUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && OPENCHAT_HOSTS.has(url.hostname) && /^\/o\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export const basicInfoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(BOT_LIMITS.nameMin, "validation.nameLength")
    .max(BOT_LIMITS.nameMax, "validation.nameLength"),
  description: z.string().trim().max(BOT_LIMITS.descriptionMax, "validation.descriptionMax"),
  roomUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || isSupportedOpenChatUrl(v), "validation.openChatUrl"),
  locale: z.enum(REPLY_LOCALES),
  timezone: z.string().min(1),
});

export const rolesSchema = z
  .object({
    roles: z
      .array(z.enum(ROLE_IDS))
      .min(BOT_LIMITS.rolesMin, "validation.rolesRange")
      .max(BOT_LIMITS.rolesMax, "validation.rolesRange"),
    faq: z.string().max(BOT_LIMITS.faqMax, "validation.faqMax"),
    customPrompt: z.string().max(BOT_LIMITS.customPromptMax, "validation.customPromptMax"),
  })
  .superRefine((v, ctx) => {
    if (v.roles.includes("faq") && v.faq.trim() === "") {
      ctx.addIssue({ code: "custom", path: ["faq"], message: "validation.faqRequired" });
    }
    if (v.roles.includes("custom") && v.customPrompt.trim() === "") {
      ctx.addIssue({ code: "custom", path: ["customPrompt"], message: "validation.customRequired" });
    }
  });

export const responseSchema = z.object({
  trigger: z
    .string()
    .trim()
    .min(1, "validation.triggerRequired")
    .max(12, "validation.triggerMax")
    .refine((v) => !/\s/.test(v), "validation.triggerNoSpace"),
  tone: z.enum(TONES),
  length: z.enum(LENGTHS),
  replyLocale: z.enum(REPLY_LOCALES),
  modelId: z.string().min(1, "validation.modelRequired"),
  dailyLimit: z.number().int().min(1, "validation.dailyLimit").max(1000, "validation.dailyLimit"),
});

export const botInputSchema = basicInfoSchema.and(rolesSchema).and(responseSchema);
export type BotInput = z.infer<typeof botInputSchema>;

export const joinRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .refine((v) => v === "" || isSupportedOpenChatUrl(v), "validation.openChatUrl"),
  roomLabel: z.string().trim().min(1, "validation.roomLabelRequired").max(60, "validation.roomLabelMax"),
  permissionConfirmed: z.literal(true, "validation.permissionRequired"),
  noticeConfirmed: z.literal(true, "validation.noticeRequired"),
});
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;

/** zod 오류를 { field: messageKey } 로 평탄화 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

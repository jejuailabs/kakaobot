import { revealConversation } from "@/lib/server/admin-data";
import { adminRoute, apiError, readJson } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 원문 열람: conversations.reveal 권한 + 사유. 열람 행위는 감사 기록된다. */
export const POST = adminRoute<{ id: string }>(
  "conversations.reveal",
  async ({ req, user, params }) => {
    const b = (await readJson(req)) as { reason?: unknown };
    if (typeof b.reason !== "string" || b.reason.trim().length < 4) throw apiError(400, "validation", "errors.validation");
    return { conversation: await revealConversation(user, params.id, b.reason.trim()) };
  },
  { mutation: true },
);

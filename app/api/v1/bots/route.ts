import { readJson, userRoute, apiError } from "@/lib/server/api";
import { createBot, listBots } from "@/lib/server/bots";
import { maxBotsFor } from "@/lib/server/workspace-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/bots — 본인 workspace 의 챗봇 목록 */
export const GET = userRoute(async ({ user }) => ({ bots: await listBots(user.workspaceId) }));

/** POST /api/v1/bots — 생성 (Idempotency-Key 필수, workspace scope) */
export const POST = userRoute(
  async ({ req, user }) => {
    const key = req.headers.get("idempotency-key");
    if (!key) throw apiError(400, "validation", "errors.validation");
    const body = await readJson(req);
    const bot = await createBot(user.workspaceId, body, key, await maxBotsFor(user.workspaceId));
    return { bot };
  },
  { mutation: true },
);

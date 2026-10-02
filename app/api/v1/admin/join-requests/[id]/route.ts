import { adminRoute, apiError, readJson } from "@/lib/server/api";
import { resolveJoin } from "@/lib/server/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — body: { decision: "joined" | "rejected", reason } (사유 필수, 감사 기록) */
export const POST = adminRoute<{ id: string }>(
  "joins.manage",
  async ({ req, user, params }) => {
    const body = (await readJson(req)) as { decision?: unknown; reason?: unknown };
    if ((body.decision !== "joined" && body.decision !== "rejected") || typeof body.reason !== "string" || body.reason.trim().length < 4) {
      throw apiError(400, "validation", "errors.validation");
    }
    await resolveJoin(params.id, body.decision, user, body.reason.trim().slice(0, 500));
    return { ok: true };
  },
  { mutation: true },
);

import { setMemberLimit, setMemberStatus } from "@/lib/server/admin-data";
import { adminRoute, apiError, readJson } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH — { action: "status", status: "active"|"suspended", reason } | { action: "limit", dailyLimit, reason } (사유 필수, 감사 기록) */
export const PATCH = adminRoute<{ uid: string }>(
  "members.manage",
  async ({ req, user, params }) => {
    const b = (await readJson(req)) as { action?: unknown; status?: unknown; dailyLimit?: unknown; reason?: unknown };
    if (typeof b.reason !== "string" || b.reason.trim().length < 4) throw apiError(400, "validation", "errors.validation");
    if (b.action === "status" && (b.status === "active" || b.status === "suspended")) await setMemberStatus(user, params.uid, b.status, b.reason.trim());
    else if (b.action === "limit" && typeof b.dailyLimit === "number") await setMemberLimit(user, params.uid, b.dailyLimit, b.reason.trim());
    else throw apiError(400, "validation", "errors.validation");
    return { ok: true };
  },
  { mutation: true },
);

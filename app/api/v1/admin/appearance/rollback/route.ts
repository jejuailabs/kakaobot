import { revalidateTag } from "next/cache";
import { adminRoute, apiError, readJson } from "@/lib/server/api";
import { APPEARANCE_TAG, rollbackTo } from "@/lib/server/appearance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** body: { assetId, expectedVersion, reason } — 이전 배경을 마지막 설정으로 다시 적용 */
export const POST = adminRoute(
  "appearance.manage",
  async ({ req, user }) => {
    const b = (await readJson(req)) as { assetId?: unknown; expectedVersion?: unknown; reason?: unknown };
    if (typeof b.assetId !== "string" || typeof b.expectedVersion !== "number" || typeof b.reason !== "string" || b.reason.trim().length < 4) throw apiError(400, "validation", "errors.validation");
    await rollbackTo(user, b.assetId, b.expectedVersion, b.reason.trim());
    revalidateTag(APPEARANCE_TAG, { expire: 0 });
    return { ok: true };
  },
  { mutation: true },
);

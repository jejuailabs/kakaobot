import { revalidateTag } from "next/cache";
import { adminRoute, apiError, readJson } from "@/lib/server/api";
import { APPEARANCE_TAG, publishAsset } from "@/lib/server/appearance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** body: { assetId, theme, settings:{overlay,blur,brightness,scope}, expectedVersion, reason } — 사유 필수, 감사 기록 */
export const POST = adminRoute(
  "appearance.manage",
  async ({ req, user }) => {
    const b = (await readJson(req)) as { assetId?: unknown; theme?: unknown; settings?: Record<string, unknown>; expectedVersion?: unknown; reason?: unknown };
    const st = b.settings ?? {};
    if (
      typeof b.assetId !== "string" ||
      (b.theme !== "light" && b.theme !== "dark") ||
      typeof b.expectedVersion !== "number" ||
      typeof b.reason !== "string" ||
      b.reason.trim().length < 4 ||
      typeof st.overlay !== "number" ||
      typeof st.blur !== "number" ||
      typeof st.brightness !== "number" ||
      !["all", "dashboard", "landing"].includes(String(st.scope))
    ) {
      throw apiError(400, "validation", "errors.validation");
    }
    await publishAsset(user, b.assetId, b.theme, { overlay: st.overlay, blur: st.blur, brightness: st.brightness, scope: st.scope as "all" }, b.expectedVersion, b.reason.trim());
    revalidateTag(APPEARANCE_TAG, { expire: 0 });
    return { ok: true };
  },
  { mutation: true },
);

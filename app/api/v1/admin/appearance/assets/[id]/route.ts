import { adminRoute } from "@/lib/server/api";
import { deleteAsset } from "@/lib/server/appearance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 사용 중인 배경은 409 로 거절 */
export const DELETE = adminRoute<{ id: string }>(
  "appearance.manage",
  async ({ user, params }) => {
    await deleteAsset(user, params.id);
    return { ok: true };
  },
  { mutation: true },
);

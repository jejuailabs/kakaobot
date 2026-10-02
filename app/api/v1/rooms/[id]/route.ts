import { readJson, userRoute } from "@/lib/server/api";
import { setRetention } from "@/lib/server/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH — body: { retentionDays: 7 | 30 | 90 } */
export const PATCH = userRoute<{ id: string }>(
  async ({ req, user, params }) => {
    const body = (await readJson(req)) as { retentionDays?: unknown };
    return { room: await setRetention(user.workspaceId, decodeURIComponent(params.id), body.retentionDays) };
  },
  { mutation: true },
);

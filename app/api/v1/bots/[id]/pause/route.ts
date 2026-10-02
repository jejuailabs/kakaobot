import { readJson, userRoute } from "@/lib/server/api";
import { setPaused } from "@/lib/server/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — body: { paused: boolean, expectedVersion } */
export const POST = userRoute<{ id: string }>(
  async ({ req, user, params }) => {
    const body = (await readJson(req)) as { paused?: unknown; expectedVersion?: unknown };
    return { bot: await setPaused(user.workspaceId, params.id, body.paused === true, body.expectedVersion) };
  },
  { mutation: true },
);

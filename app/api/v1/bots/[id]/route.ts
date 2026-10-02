import { readJson, userRoute } from "@/lib/server/api";
import { deleteBot, getBot, updateBot } from "@/lib/server/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = { id: string };

export const GET = userRoute<P>(async ({ user, params }) => ({ bot: await getBot(user.workspaceId, params.id) }));

/** PATCH — body: { patch, expectedVersion }. 버전 불일치 409 */
export const PATCH = userRoute<P>(
  async ({ req, user, params }) => {
    const body = (await readJson(req)) as { patch?: unknown; expectedVersion?: unknown };
    return { bot: await updateBot(user.workspaceId, params.id, body.patch, body.expectedVersion) };
  },
  { mutation: true },
);

export const DELETE = userRoute<P>(
  async ({ user, params }) => {
    await deleteBot(user.workspaceId, params.id);
    return { ok: true };
  },
  { mutation: true },
);

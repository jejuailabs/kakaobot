import { readJson, userRoute } from "@/lib/server/api";
import { deleteDraft, getDraft, saveDraft } from "@/lib/server/drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = { id: string };

export const GET = userRoute<P>(async ({ user, params }) => ({ draft: await getDraft(user.workspaceId, params.id) }));
export const PUT = userRoute<P>(async ({ req, user, params }) => ({ draft: await saveDraft(user.workspaceId, params.id, await readJson(req)) }), { mutation: true });
export const DELETE = userRoute<P>(
  async ({ user, params }) => {
    await deleteDraft(user.workspaceId, params.id);
    return { ok: true };
  },
  { mutation: true },
);

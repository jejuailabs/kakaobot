import { readJson, userRoute } from "@/lib/server/api";
import { requestJoin } from "@/lib/server/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = userRoute<{ id: string }>(async ({ req, user, params }) => ({ joinRequest: await requestJoin(user.workspaceId, params.id, await readJson(req)) }), { mutation: true });

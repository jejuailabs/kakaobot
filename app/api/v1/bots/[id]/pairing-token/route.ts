import { userRoute } from "@/lib/server/api";
import { issuePairingCode } from "@/lib/server/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 원문 코드는 이 응답에서만 한 번 전달된다 (서버에는 hash 만 저장). */
export const POST = userRoute<{ id: string }>(async ({ user, params }) => ({ pairingCode: await issuePairingCode(user.workspaceId, params.id) }), { mutation: true });

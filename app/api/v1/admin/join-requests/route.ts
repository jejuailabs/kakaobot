import { adminRoute } from "@/lib/server/api";
import { listJoinQueue } from "@/lib/server/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("joins.manage", async () => ({ requests: await listJoinQueue() }));

import { adminRoute } from "@/lib/server/api";
import { listAppearance } from "@/lib/server/appearance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("appearance.manage", async () => listAppearance());

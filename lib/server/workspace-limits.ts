import "server-only";
import { BOT_LIMITS } from "@/lib/shared/domain";
import { adminDb } from "./firebase-admin";

export async function maxBotsFor(workspaceId: string): Promise<number> {
  const snap = await adminDb().collection("workspaces").doc(workspaceId).get();
  const v = snap.data()?.limits?.maxBots;
  return typeof v === "number" && v > 0 ? v : BOT_LIMITS.maxBotsPerWorkspace;
}

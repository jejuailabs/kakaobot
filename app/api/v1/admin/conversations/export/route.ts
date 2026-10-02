import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminRoute, apiError, readJson } from "@/lib/server/api";
import { adminDb } from "@/lib/server/firebase-admin";
import { csvCell, maskText } from "@/lib/shared/masking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV 내보내기: 별도 권한, 최근 최대 30일·1,000건, 원문은 마스킹, formula injection 방지, 감사 기록 */
export const POST = adminRoute(
  "conversations.export",
  async ({ req, user }) => {
    const b = (await readJson(req)) as { days?: unknown; reason?: unknown };
    const days = typeof b.days === "number" ? Math.min(30, Math.max(1, Math.floor(b.days))) : 7;
    if (typeof b.reason !== "string" || b.reason.trim().length < 4) throw apiError(400, "validation", "errors.validation");
    const since = Timestamp.fromMillis(Date.now() - days * 86_400_000);
    const snap = await adminDb().collection("conversationLogs").where("createdAt", ">=", since).orderBy("createdAt", "desc").limit(1000).get();
    const rows: (string | number)[][] = [["createdAt", "workspaceId", "botId", "model", "status", "latencyMs", "inputTokens", "outputTokens", "costMicros", "input(masked)", "output(masked)"]];
    for (const d of snap.docs) {
      const x = d.data();
      rows.push([(x.createdAt as Timestamp).toDate().toISOString(), x.workspaceId, x.botId, x.model, x.status, x.latencyMs ?? 0, x.inputTokens ?? 0, x.outputTokens ?? 0, x.costMicros ?? 0, maskText(x.input ?? ""), maskText(x.output ?? "")]);
    }
    await adminDb()
      .collection("auditLogs")
      .add({ actorUid: user.uid, actorRole: user.roles.join(","), workspaceId: null, action: "conversation.export", targetId: `${days}d · ${snap.size}`, reason: b.reason.trim().slice(0, 500), at: FieldValue.serverTimestamp() });
    const csv = "﻿" + rows.map((r) => r.map((c) => csvCell(c)).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="katcha-conversations-${days}d.csv"`, "cache-control": "no-store" },
    });
  },
  { mutation: true },
);

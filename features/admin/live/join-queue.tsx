"use client";

import { DoorOpen, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { EmptyState, GlassCard, StatusPill } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRelativeTime } from "@/components/ui/use-relative-time";
import { ReasonDialog } from "@/features/admin/reason-dialog";
import { joinStateTone } from "@/features/bots/status";
import { PageHeader } from "@/features/console/console-frame";
import { csrfToken } from "@/lib/client/firebase";
import type { JoinRequestState } from "@/lib/shared/domain";

export type QueueItem = { id: string; workspaceId: string; botId: string; url: string; roomLabel: string; state: string; createdAt: string };

/** 실제 운영자 입장 요청 처리 (사유 필수 → 감사 기록) */
export function LiveJoinQueue({ items }: { items: QueueItem[] }) {
  const t = useTranslations();
  const rel = useRelativeTime();
  const toast = useToast();
  const router = useRouter();
  const [target, setTarget] = React.useState<{ id: string; decision: "joined" | "rejected" } | null>(null);

  async function resolve(id: string, decision: "joined" | "rejected", reason: string) {
    const res = await fetch(`/api/v1/admin/join-requests/${encodeURIComponent(id)}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-katcha-csrf": csrfToken() },
      body: JSON.stringify({ decision, reason }),
    });
    if (res.ok) {
      toast(decision === "joined" ? t("admin.join.markedJoined") : t("admin.join.rejected"));
      router.refresh();
    } else toast(t("errors.invalid_state"), "error");
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("nav.joinRequests")} description={t("admin.join.subtitle")} />
      <GlassCard>
        {items.length === 0 ? (
          <EmptyState icon={<DoorOpen />} title={t("admin.join.empty")} />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--glass-border)]">
            {items.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {r.roomLabel}
                    <StatusPill tone={joinStateTone[r.state as JoinRequestState] ?? "neutral"}>{t(`status.join.${r.state}`)}</StatusPill>
                  </p>
                  <p className="mt-1 text-caption text-muted">
                    <code>{r.workspaceId}</code> · {r.createdAt ? rel(r.createdAt) : "—"}
                  </p>
                  {r.url && (
                    <p className="mt-1 flex items-center gap-1 text-caption text-muted">
                      <ExternalLink className="size-3" aria-hidden />
                      <span className="[overflow-wrap:anywhere]">{r.url}</span>
                    </p>
                  )}
                </div>
                {r.state === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setTarget({ id: r.id, decision: "joined" })}>
                      {t("admin.join.joined")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTarget({ id: r.id, decision: "rejected" })}>
                      {t("admin.join.reject")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-caption text-muted">{t("admin.join.note")}</p>
      </GlassCard>
      <ReasonDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.decision === "joined" ? t("admin.join.joined") : t("admin.join.reject")}
        confirmLabel={target?.decision === "joined" ? t("admin.join.joined") : t("admin.join.reject")}
        tone={target?.decision === "rejected" ? "danger" : "primary"}
        onConfirm={async (reason) => {
          if (target) await resolve(target.id, target.decision, reason);
        }}
      />
    </div>
  );
}

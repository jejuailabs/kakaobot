"use client";

import { Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState, GlassCard, StatusPill } from "@/components/glass/glass-card";
import { RoomRow } from "@/components/glass/room-row";
import { Button } from "@/components/ui/button";
import { joinStateTone } from "@/features/bots/status";
import { useConsole } from "@/features/console/console-context";
import { PageHeader } from "@/features/console/console-frame";
import { Link } from "@/i18n/navigation";
import { useRelativeTime } from "@/components/ui/use-relative-time";

export function RoomsView() {
  const t = useTranslations();
  const rel = useRelativeTime();
  const { snapshot, href } = useConsole();
  // 고객에게는 본인 연결방과 본인 입장 요청만 보인다. 운영자가 발견한 미연결 방 목록은 노출하지 않는다.
  const pending = snapshot.joinRequests.filter((j) => j.state === "pending" || j.state === "awaiting_code" || j.state === "rejected");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("rooms.title")} description={t("rooms.subtitle")} />
      <GlassCard>
        {snapshot.rooms.length === 0 ? (
          <EmptyState
            icon={<Link2 />}
            title={t("rooms.emptyTitle")}
            description={t("rooms.emptyDesc")}
            action={
              <Button asChild>
                <Link href={href("bots")}>{t("rooms.emptyCta")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="-mx-2 flex flex-col">
            {snapshot.rooms.map((room) => {
              const bot = snapshot.bots.find((b) => b.id === room.botId);
              return (
                <li key={room.id} className="border-b border-glass-border last:border-0">
                  <RoomRow room={room} botName={bot?.name ?? "—"} href={bot ? `${href(`bots/${bot.id}`)}?tab=connection` : undefined} />
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      {pending.length > 0 && (
        <GlassCard>
          <h2 className="mb-3 text-section font-semibold">{t("rooms.requests")}</h2>
          <ul className="flex flex-col divide-y divide-[var(--glass-border)]">
            {pending.map((j) => {
              const bot = snapshot.bots.find((b) => b.id === j.botId);
              return (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{j.roomLabel}</p>
                    <p className="text-caption text-muted">
                      {bot?.name} · {rel(j.createdAt)}
                    </p>
                    {j.state === "rejected" && j.rejectReasonKey && <p className="text-caption text-danger">{t(j.rejectReasonKey)}</p>}
                  </div>
                  <StatusPill tone={joinStateTone[j.state]}>{t(`status.join.${j.state}`)}</StatusPill>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}

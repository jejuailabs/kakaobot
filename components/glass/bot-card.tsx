"use client";

import { ChevronRight, MessagesSquare } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { StatusPill } from "@/components/glass/glass-card";
import { Avatar } from "@/components/glass/room-row";
import { botStateTone } from "@/features/bots/status";
import { Link } from "@/i18n/navigation";
import type { Bot } from "@/lib/shared/domain";

export function BotCard({ bot, href }: { bot: Bot; href: string }) {
  const t = useTranslations();
  const format = useFormatter();
  return (
    <Link href={href} className="glass-card glass-hover group flex h-full flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <Avatar label={bot.name} seed={bot.id} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-6 [overflow-wrap:anywhere]">{bot.name}</h2>
          <p className="line-clamp-2 text-label text-muted">{bot.description || t("bots.noDescription")}</p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {bot.roles.map((r) => (
          <span key={r} className="rounded-full bg-selected px-2.5 py-0.5 text-caption font-semibold text-primary">
            {t(`roles.${r}.title`)}
          </span>
        ))}
        <span className="rounded-full border border-glass-border px-2.5 py-0.5 text-caption font-semibold text-muted">{bot.trigger}</span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-glass-border pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted">
          <MessagesSquare className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{bot.roomLabel ?? t("bots.noRoom")}</span>
          {bot.messages30d > 0 && <span className="tabular">· {t("bots.messages30d", { count: format.number(bot.messages30d) })}</span>}
        </span>
        <StatusPill tone={botStateTone[bot.state]}>{t(`status.bot.${bot.state}`)}</StatusPill>
      </div>
    </Link>
  );
}

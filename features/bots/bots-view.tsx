"use client";

import { Bot as BotIcon, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { BotCard } from "@/components/glass/bot-card";
import { EmptyState, GlassCard } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { useConsole } from "@/features/console/console-context";
import { PageHeader } from "@/features/console/console-frame";
import { Link } from "@/i18n/navigation";

export function BotsView() {
  const t = useTranslations();
  const { snapshot, href } = useConsole();
  const atLimit = snapshot.bots.length >= snapshot.limits.maxBots;

  const createButton = atLimit ? (
    <Button disabled aria-describedby="bot-limit-note">
      <Plus aria-hidden />
      {t("dashboard.newBot")}
    </Button>
  ) : (
    <Button asChild>
      <Link href={href("bots/new")}>
        <Plus aria-hidden />
        {t("dashboard.newBot")}
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader
        title={t("bots.title")}
        description={t("bots.subtitle", { count: snapshot.bots.length, max: snapshot.limits.maxBots })}
        actions={createButton}
      />
      {atLimit && (
        <p id="bot-limit-note" className="mb-4 text-label text-warning">
          {t("bots.limitReached", { max: snapshot.limits.maxBots })}
        </p>
      )}
      {snapshot.bots.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<BotIcon />}
            title={t("bots.emptyTitle")}
            description={t("bots.emptyDesc")}
            action={
              <Button asChild>
                <Link href={href("bots/new")}>{t("dashboard.newBot")}</Link>
              </Button>
            }
          />
        </GlassCard>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {snapshot.bots.map((bot) => (
            <li key={bot.id}>
              <BotCard bot={bot} href={href(`bots/${bot.id}`)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

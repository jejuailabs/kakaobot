"use client";

import { FileText } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { EmptyState, GlassCard } from "@/components/glass/glass-card";
import { useConsole } from "@/features/console/console-context";
import { PageHeader } from "@/features/console/console-frame";
import { Link } from "@/i18n/navigation";

export function PromptsView() {
  const t = useTranslations();
  const format = useFormatter();
  const { snapshot, href } = useConsole();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("prompts.title")} description={t("prompts.subtitle")} />
      {snapshot.bots.length === 0 ? (
        <GlassCard>
          <EmptyState icon={<FileText />} title={t("prompts.emptyTitle")} description={t("bots.emptyDesc")} />
        </GlassCard>
      ) : (
        snapshot.bots.map((bot) => {
          const versions = snapshot.prompts.filter((p) => p.botId === bot.id).sort((a, b) => b.version - a.version);
          return (
            <GlassCard key={bot.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-section font-semibold">{bot.name}</h2>
                <Link href={`${href(`bots/${bot.id}`)}?tab=prompt`} className="text-label font-semibold text-primary hover:underline">
                  {t("prompts.edit")}
                </Link>
              </div>
              <ol className="flex flex-col gap-2">
                {versions.map((p) => (
                  <li key={p.id} className="flex flex-col gap-1 rounded-[12px] border border-glass-border bg-input p-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="flex shrink-0 items-center gap-2 sm:w-40 sm:flex-col sm:items-start sm:gap-0.5">
                      <span className="font-semibold">
                        v{p.version}
                        {p.version === bot.promptVersion && <span className="ml-2 rounded-full bg-selected px-2 py-0.5 text-caption text-primary">{t("prompts.current")}</span>}
                      </span>
                      <time className="text-caption text-muted" dateTime={p.createdAt}>
                        {format.dateTime(new Date(p.createdAt), { dateStyle: "medium" })}
                      </time>
                    </div>
                    <p className="line-clamp-2 text-label text-muted">{p.body || t("bot.emptyPrompt")}</p>
                  </li>
                ))}
              </ol>
            </GlassCard>
          );
        })
      )}
    </div>
  );
}

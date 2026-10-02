"use client";

import { AlertCircle, Bot as BotIcon, CheckCircle2, Link2, MessageSquareText, MessagesSquare, Plus, Settings2 } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { CardTitle, EmptyState, GlassCard, StatCard } from "@/components/glass/glass-card";
import { RoomRow } from "@/components/glass/room-row";
import { UsageChart } from "@/components/glass/usage-chart";
import { Button } from "@/components/ui/button";
import { lastNDays, monthToDate, pctChange, totals } from "@/features/analytics/metrics";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/shared/cn";
import { useConsole } from "./console-context";
import { PageHeader } from "./console-frame";
import { useRelativeTime } from "@/components/ui/use-relative-time";

export function RangeToggle({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: number[] }) {
  const t = useTranslations("common");
  return (
    <div role="radiogroup" aria-label={t("period")} className="flex shrink-0 gap-1 rounded-full border border-glass-border bg-input p-1">
      {options.map((d) => (
        <button
          key={d}
          role="radio"
          aria-checked={value === d}
          onClick={() => onChange(d)}
          className={cn("h-8 whitespace-nowrap rounded-full px-3 text-caption font-semibold text-muted", value === d && "bg-primary text-primary-fg")}
        >
          {t("days", { count: d })}
        </button>
      ))}
    </div>
  );
}

export function DashboardView() {
  const t = useTranslations();
  const format = useFormatter();
  const rel = useRelativeTime();
  const { snapshot, href } = useConsole();
  const [range, setRange] = React.useState(7);
  const now = useNow();

  const activeBots = snapshot.bots.filter((b) => b.state === "active").length;
  const connectedRooms = snapshot.rooms.filter((r) => r.state === "connected").length;
  const month = totals(monthToDate(snapshot.usage, now));
  const { current, previous } = lastNDays(snapshot.usage, range);
  const cur = totals(current);
  const prev = totals(previous);
  const change = pctChange(cur.requests, prev.requests);
  const featured = snapshot.bots.find((b) => b.state === "active") ?? snapshot.bots[0];

  const pct = (v: number) => format.number(v, { style: "percent", maximumFractionDigits: 1 });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("dashboard.greeting", { name: snapshot.user.displayName })}
        description={t("dashboard.subtitle")}
        actions={
          <Button asChild>
            <Link href={href("bots/new")}>
              <Plus aria-hidden />
              {t("dashboard.newBot")}
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard label={t("dashboard.kpiActiveBots")} value={format.number(activeBots)} icon={<BotIcon />} hint={t("dashboard.ofTotal", { total: snapshot.bots.length })} />
        <StatCard
          label={t("dashboard.kpiMessages")}
          value={format.number(month.requests)}
          icon={<MessageSquareText />}
          hint={month.requests === 0 ? t("dashboard.noMessagesYet") : t("dashboard.monthToDate")}
        />
        <StatCard label={t("dashboard.kpiRooms")} value={format.number(connectedRooms)} icon={<MessagesSquare />} hint={connectedRooms === 0 ? t("dashboard.connectHint") : undefined} />
        <StatCard
          label={t("dashboard.kpiSuccess")}
          value={month.successRate == null ? "—" : pct(month.successRate)}
          icon={<CheckCircle2 />}
          hint={month.successRate == null ? t("dashboard.noSample") : t("dashboard.monthToDate")}
        />
      </div>

      <GlassCard>
        <CardTitle action={<RangeToggle value={range} onChange={setRange} options={[7, 30]} />}>
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {t("dashboard.usageTitle")}
            {change != null && (
              <span className={cn("text-caption font-semibold tabular", change >= 0 ? "text-success" : "text-danger")}>
                {t("dashboard.vsPrevious", { value: `${change >= 0 ? "+" : ""}${pct(change)}` })}
              </span>
            )}
          </span>
        </CardTitle>
        <UsageChart data={current} />
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <GlassCard>
          <CardTitle
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href={href("rooms")}>{t("common.viewAll")}</Link>
              </Button>
            }
          >
            {t("dashboard.recentRooms")}
          </CardTitle>
          {snapshot.rooms.length === 0 ? (
            <EmptyState
              icon={<Link2 />}
              title={t("rooms.emptyTitle")}
              description={t("rooms.emptyDesc")}
              action={
                <Button asChild size="sm">
                  <Link href={href("bots")}>{t("rooms.emptyCta")}</Link>
                </Button>
              }
              className="py-8"
            />
          ) : (
            <div className="-mx-2 flex flex-col">
              {snapshot.rooms.slice(0, 4).map((room) => {
                const bot = snapshot.bots.find((b) => b.id === room.botId);
                return <RoomRow key={room.id} room={room} botName={bot?.name ?? "—"} href={bot ? href(`bots/${bot.id}`) : undefined} />;
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard className="flex flex-col">
          <CardTitle>{t("dashboard.settingsPreview")}</CardTitle>
          {featured ? (
            <div className="flex flex-1 flex-col gap-4">
              <p className="rounded-[12px] bg-input p-3 text-label leading-5 text-muted">
                {t("dashboard.triggerExplain", { trigger: featured.trigger, bot: featured.name })}
              </p>
              <dl className="grid grid-cols-2 gap-3 text-label">
                <div>
                  <dt className="text-caption text-muted">{t("bot.trigger")}</dt>
                  <dd className="mt-0.5 font-semibold">{featured.trigger}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted">{t("bot.tone")}</dt>
                  <dd className="mt-0.5 font-semibold">{t(`tone.${featured.tone}`)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-caption text-muted">{t("bot.roles")}</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {featured.roles.map((r) => (
                      <span key={r} className="rounded-full bg-selected px-2.5 py-0.5 text-caption font-semibold text-primary">
                        {t(`roles.${r}.title`)}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
              <Button asChild variant="secondary" className="mt-auto">
                <Link href={href(`bots/${featured.id}`)}>
                  <Settings2 aria-hidden />
                  {t("dashboard.editSettings")}
                </Link>
              </Button>
            </div>
          ) : (
            <EmptyState icon={<BotIcon />} title={t("bots.emptyTitle")} description={t("bots.emptyDesc")} className="py-8" />
          )}
        </GlassCard>
      </div>

      <GlassCard>
        <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
        {snapshot.activities.length === 0 ? (
          <p className="text-body text-muted">{t("dashboard.noActivity")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--glass-border)]">
            {snapshot.activities.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
                    a.kind === "failed" ? "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger" : "bg-selected text-primary",
                  )}
                  aria-hidden
                >
                  {a.kind === "failed" ? <AlertCircle className="size-4" /> : a.kind === "connected" ? <Link2 className="size-4" /> : <Settings2 className="size-4" />}
                </span>
                <p className="min-w-0 flex-1 text-body">{t(`dashboard.activity.${a.kind}`, { bot: a.botName })}</p>
                <time dateTime={a.at} className="shrink-0 text-caption text-muted">
                  {rel(a.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

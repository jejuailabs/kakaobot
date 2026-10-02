"use client";

import { AlertCircle, CheckCircle2, MessageSquareText } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { CardTitle, GlassCard, StatCard } from "@/components/glass/glass-card";
import { UsageChart } from "@/components/glass/usage-chart";
import { useConsole } from "@/features/console/console-context";
import { PageHeader } from "@/features/console/console-frame";
import { RangeToggle } from "@/features/console/dashboard-view";
import { lastNDays, totals } from "./metrics";

export function AnalyticsView() {
  const t = useTranslations();
  const format = useFormatter();
  const { snapshot } = useConsole();
  const [range, setRange] = React.useState(30);
  const { current } = lastNDays(snapshot.usage, range);
  const sum = totals(current);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("analytics.title")} description={t("analytics.subtitle")} actions={<RangeToggle value={range} onChange={setRange} options={[7, 30, 90]} />} />
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3">
        <StatCard label={t("analytics.requests")} value={format.number(sum.requests)} icon={<MessageSquareText />} />
        <StatCard label={t("analytics.succeeded")} value={sum.successRate == null ? "—" : format.number(sum.successRate, { style: "percent", maximumFractionDigits: 1 })} icon={<CheckCircle2 />} />
        <StatCard label={t("analytics.failed")} value={format.number(sum.failed)} icon={<AlertCircle />} />
      </div>
      <GlassCard>
        <CardTitle>{t("analytics.daily")}</CardTitle>
        <UsageChart data={current} height={280} />
      </GlassCard>
      <GlassCard>
        <CardTitle>{t("analytics.table")}</CardTitle>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[420px] text-left text-body">
            <caption className="sr-only">{t("analytics.table")}</caption>
            <thead className="text-caption text-muted">
              <tr className="border-b border-glass-border">
                <th scope="col" className="py-2 font-medium">{t("analytics.date")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("analytics.requests")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("analytics.failed")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("chart.successRate")}</th>
              </tr>
            </thead>
            <tbody>
              {[...current].reverse().slice(0, 14).map((d) => (
                <tr key={d.date} className="border-b border-glass-border last:border-0">
                  <td className="py-2.5">{format.dateTime(new Date(`${d.date}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" })}</td>
                  <td className="py-2.5 text-right tabular">{format.number(d.requests)}</td>
                  <td className="py-2.5 text-right tabular">{format.number(d.failed)}</td>
                  <td className="py-2.5 text-right tabular">{d.requests ? format.number(d.succeeded / d.requests, { style: "percent", maximumFractionDigits: 1 }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-caption text-muted">{t("analytics.note")}</p>
      </GlassCard>
    </div>
  );
}

"use client";

import { Activity, Bot, CheckCircle2, Coins, Download, Gauge, MessagesSquare, Timer, UserPlus, Users } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { CardTitle, GlassCard, StatCard, StatusPill } from "@/components/glass/glass-card";
import { UsageChart } from "@/components/glass/usage-chart";
import { Button } from "@/components/ui/button";
import { totals, lastNDays } from "@/features/analytics/metrics";
import { gatewayTone } from "@/features/bots/status";
import { useConsole } from "@/features/console/console-context";
import { PageHeader } from "@/features/console/console-frame";
import { RangeToggle } from "@/features/console/dashboard-view";
import { csvCell } from "@/lib/shared/masking";
import { useAdmin } from "./admin-context";
import { useRelativeTime } from "@/components/ui/use-relative-time";

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminOverview() {
  const t = useTranslations();
  const format = useFormatter();
  const rel = useRelativeTime();
  const { snapshot } = useConsole();
  const { data } = useAdmin();
  const [range, setRange] = React.useState(30);
  const now = useNow();

  // demo: 플랫폼 합계를 표현하기 위해 고객 demo 사용량을 확대한 예시값
  const platformUsage = snapshot.usage.map((d) => ({ ...d, requests: d.requests * 6, succeeded: d.succeeded * 6, failed: d.failed * 6 }));
  const { current, previous } = lastNDays(platformUsage, range);
  const cur = totals(current);
  const prev = totals(previous);
  const members = data.members.length;
  const newMembers = data.members.filter((m) => now.getTime() - new Date(m.joinedAt).getTime() < range * 86_400_000).length;
  const cost = data.members.reduce((a, m) => a + m.monthCostMicros, 0) / 1_000_000;
  const delta = (c: number, p: number) => (p > 0 ? { text: `${c >= p ? "+" : ""}${format.number((c - p) / p, { style: "percent", maximumFractionDigits: 1 })}`, positive: c >= p } : null);

  const providers = [
    { label: "Standard (demo)", value: 0.74 },
    { label: "Fast (demo)", value: 0.26 },
  ];
  const errors = [
    { key: "provider_429", value: 41 },
    { key: "provider_timeout", value: 18 },
    { key: "delivery_unknown", value: 6 },
    { key: "budget_exceeded", value: 12 },
  ];
  const maxErr = Math.max(...errors.map((e) => e.value));
  const maxSignup = Math.max(...data.signups.map((s) => s.value));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("admin.overview.title")}
        description={t("admin.overview.updated", { time: rel(data.updatedAt) })}
        actions={
          <>
            <RangeToggle value={range} onChange={setRange} options={[7, 30, 90]} />
            <Button
              variant="secondary"
              size="sm"
              className="h-10"
              onClick={() =>
                download(`katcha-metrics-${range}d.csv`, [
                  ["date", "requests", "succeeded", "failed"],
                  ...current.map((d) => [d.date, d.requests, d.succeeded, d.failed]),
                ])
              }
            >
              <Download aria-hidden />
              CSV
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t("admin.overview.members")} value={format.number(members)} icon={<Users />} />
        <StatCard label={t("admin.overview.newMembers")} value={format.number(newMembers)} icon={<UserPlus />} hint={t("common.days", { count: range })} />
        <StatCard label="DAU / MAU" value={`${format.number(7)} / ${format.number(members - 1)}`} icon={<Activity />} hint={t("admin.overview.dauDef")} />
        <StatCard label={t("admin.overview.activeBots")} value={format.number(data.members.reduce((a, m) => a + (m.status === "active" ? m.bots : 0), 0))} icon={<Bot />} />
        <StatCard label={t("admin.overview.rooms")} value={format.number(data.members.reduce((a, m) => a + m.rooms, 0))} icon={<MessagesSquare />} />
        <StatCard label={t("admin.overview.requests")} value={format.number(cur.requests, { notation: "compact" })} icon={<Gauge />} delta={delta(cur.requests, prev.requests)} />
        <StatCard label={t("admin.overview.success")} value={cur.successRate == null ? "—" : format.number(cur.successRate, { style: "percent", maximumFractionDigits: 1 })} icon={<CheckCircle2 />} />
        <StatCard label={t("admin.overview.p95")} value="2.8s" icon={<Timer />} />
        <StatCard label={t("admin.overview.cost")} value={format.number(cost, { style: "currency", currency: "USD" })} icon={<Coins />} hint={t("admin.overview.costHint")} />
      </div>
      <GlassCard>
        <CardTitle>{t("admin.overview.usage")}</CardTitle>
        <UsageChart data={current} />
      </GlassCard>
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard>
          <CardTitle>{t("admin.overview.signups")}</CardTitle>
          <div className="flex h-32 items-end gap-1" role="img" aria-label={t("admin.overview.signups")}>
            {data.signups.map((s) => (
              <span key={s.date} className="flex-1 rounded-t-[3px] bg-accent/70" style={{ height: `${(s.value / maxSignup) * 100}%` }} />
            ))}
          </div>
        </GlassCard>
        <GlassCard>
          <CardTitle>{t("admin.overview.providers")}</CardTitle>
          <ul className="flex flex-col gap-3">
            {providers.map((p) => (
              <li key={p.label}>
                <div className="mb-1 flex justify-between text-label">
                  <span>{p.label}</span>
                  <span className="tabular text-muted">{format.number(p.value, { style: "percent" })}</span>
                </div>
                <div className="h-2 rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${p.value * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard>
          <CardTitle>{t("admin.overview.errors")}</CardTitle>
          <ul className="flex flex-col gap-3">
            {errors.map((e) => (
              <li key={e.key}>
                <div className="mb-1 flex justify-between text-label">
                  <code className="text-caption">{e.key}</code>
                  <span className="tabular text-muted">{e.value}</span>
                </div>
                <div className="h-2 rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                  <div className="h-2 rounded-full bg-danger/80" style={{ width: `${(e.value / maxErr) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
      <GlassCard>
        <CardTitle>{t("nav.gateways")}</CardTitle>
        {data.gateways.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{g.label}</p>
              <p className="text-caption text-muted">{t("admin.gateways.heartbeat", { time: rel(g.lastHeartbeat) })}</p>
            </div>
            <StatusPill tone={gatewayTone[g.health]}>{t(`status.gateway.${g.health}`)}</StatusPill>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

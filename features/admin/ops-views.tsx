"use client";

import { DoorOpen, ExternalLink, RotateCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { EmptyState, ErrorBanner, GlassCard, StatusPill } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { GlassSelect } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { gatewayTone, joinStateTone } from "@/features/bots/status";
import { useConsole } from "@/features/console/console-context";
import { PageHeader } from "@/features/console/console-frame";
import { useAdmin } from "./admin-context";
import { useRelativeTime } from "@/components/ui/use-relative-time";

/* ───────── 감사 이력: 조회 전용, 편집/삭제 없음 ───────── */
export function AuditView() {
  const t = useTranslations();
  const format = useFormatter();
  const { data } = useAdmin();
  const [action, setAction] = React.useState("all");
  const actions = [...new Set(data.audit.map((a) => a.action.split(".")[0]))];
  const rows = data.audit.filter((a) => action === "all" || a.action.startsWith(`${action}.`));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("nav.audit")} description={t("admin.audit.subtitle")} />
      <GlassCard className="flex flex-col gap-4">
        <div className="sm:w-56">
          <label htmlFor="audit-action" className="sr-only">{t("admin.audit.action")}</label>
          <GlassSelect id="audit-action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="all">{t("common.all")}</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </GlassSelect>
        </div>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[760px] text-left text-body">
            <caption className="sr-only">{t("nav.audit")}</caption>
            <thead className="text-caption text-muted">
              <tr className="border-b border-glass-border">
                {["time", "actor", "action", "target", "reason"].map((k) => (
                  <th key={k} scope="col" className="py-2 pr-3 font-medium">{t(`admin.audit.col.${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-glass-border last:border-0">
                  <td className="py-2.5 pr-3 text-label">{format.dateTime(new Date(a.at), { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="py-2.5 pr-3">
                    <span className="block font-medium">{a.actor}</span>
                    <span className="block text-caption text-muted">{a.role}</span>
                  </td>
                  <td className="py-2.5 pr-3"><code className="text-label">{a.action}</code></td>
                  <td className="py-2.5 pr-3 text-label">{a.target}</td>
                  <td className="py-2.5 pr-3 text-label text-muted">{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-muted">{t("admin.audit.readonly")}</p>
      </GlassCard>
    </div>
  );
}

/* ───────── 실패 작업 ───────── */
export function JobsView() {
  const t = useTranslations();
  const rel = useRelativeTime();
  const toast = useToast();
  const { data, actions } = useAdmin();
  const [busy, setBusy] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("nav.jobs")} description={t("admin.jobs.subtitle")} />
      <GlassCard>
        {data.jobs.length === 0 ? (
          <EmptyState icon={<RotateCw />} title={t("admin.jobs.empty")} />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--glass-border)]">
            {data.jobs.map((j) => (
              <li key={j.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <code>{j.id}</code>
                    <StatusPill tone={j.state === "unknown" ? "warning" : "danger"}>{t(`status.job.${j.state}`)}</StatusPill>
                    <span className="text-caption text-muted">{t(`admin.jobs.kind.${j.kind}`)}</span>
                  </p>
                  <p className="mt-1 text-caption text-muted">
                    <code>{j.errorCode}</code> · {t("admin.jobs.attempt", { count: j.attempt })} · {j.target} · {rel(j.at)}
                  </p>
                  {j.state === "unknown" && <p className="mt-1 text-caption font-medium text-warning">{t("admin.jobs.unknownNote")}</p>}
                </div>
                <Button
                  size="sm"
                  variant={j.state === "unknown" ? "outline" : "secondary"}
                  loading={busy === j.id}
                  onClick={async () => {
                    setBusy(j.id);
                    await actions.retryJob(j.id);
                    setBusy(null);
                    toast(t("admin.jobs.retried"));
                  }}
                >
                  {j.state === "unknown" ? t("admin.jobs.manualResend") : t("admin.jobs.retry")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

/* ───────── Gateway ───────── */
export function GatewaysView() {
  const t = useTranslations();
  const rel = useRelativeTime();
  const { data, mode } = useAdmin();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("nav.gateways")} description={t("admin.gateways.subtitle")} />
      <ErrorBanner tone="warning" title={t("admin.gateways.unverifiedTitle")} description={t("admin.gateways.unverifiedDesc")} />
      {data.gateways.map((g) => (
        <GlassCard key={g.id} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-section font-semibold">{g.label}</p>
              <code className="text-caption text-muted">{g.id}</code>
            </div>
            <StatusPill tone={gatewayTone[g.health]}>{t(`status.gateway.${g.health}`)}{mode === "demo" ? " (demo)" : ""}</StatusPill>
          </div>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [t("admin.gateways.lastHeartbeat"), rel(g.lastHeartbeat)],
              [t("admin.gateways.adapter"), g.adapterVersion],
              [t("admin.gateways.rooms"), g.rooms],
              [t("admin.gateways.queue"), g.queueDepth],
            ].map(([k, v]) => (
              <div key={String(k)} className="glass-card !rounded-[14px] p-3">
                <dt className="text-caption text-muted">{k}</dt>
                <dd className="font-semibold [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-caption text-muted">{t("admin.gateways.thresholds")}</p>
        </GlassCard>
      ))}
    </div>
  );
}

/* ───────── 입장 요청 queue ───────── */
export function JoinRequestsView() {
  const t = useTranslations();
  const rel = useRelativeTime();
  const toast = useToast();
  const { data, actions } = useAdmin();
  const { snapshot, actions: consoleActions } = useConsole();

  // demo: 같은 탭의 고객 demo 요청도 함께 보여주고, 처리하면 고객 화면 상태가 바뀐다.
  const own = snapshot.joinRequests
    .filter((j) => j.state === "pending")
    .map((j) => ({ id: j.id, botId: j.botId, workspace: snapshot.user.displayName, roomLabel: j.roomLabel, url: j.url, state: j.state, at: j.createdAt }));
  const rows = [...own, ...data.joinQueue.map((q) => ({ ...q, botId: null as string | null }))];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("nav.joinRequests")} description={t("admin.join.subtitle")} />
      <GlassCard>
        {rows.length === 0 ? (
          <EmptyState icon={<DoorOpen />} title={t("admin.join.empty")} />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--glass-border)]">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {r.roomLabel}
                    <StatusPill tone={joinStateTone[r.state]}>{t(`status.join.${r.state}`)}</StatusPill>
                  </p>
                  <p className="mt-1 text-caption text-muted">
                    {r.workspace} · {rel(r.at)}
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
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (r.botId) consoleActions.simulate?.operatorJoined(r.botId);
                        else await actions.resolveJoin(r.id, "joined");
                        toast(t("admin.join.markedJoined"));
                      }}
                    >
                      {t("admin.join.joined")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!r.botId) await actions.resolveJoin(r.id, "rejected");
                        toast(t("admin.join.rejected"));
                      }}
                      disabled={!!r.botId}
                    >
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
    </div>
  );
}

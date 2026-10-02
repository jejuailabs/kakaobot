"use client";

import { Search } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { GlassCard, StatusPill, type PillTone } from "@/components/glass/glass-card";
import { Avatar } from "@/components/glass/room-row";
import { Button } from "@/components/ui/button";
import { Field, GlassInput, GlassSelect } from "@/components/ui/field";
import { Sheet } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/features/console/console-frame";
import type { DemoMember, MemberStatus } from "@/lib/shared/demo-admin";
import { useAdmin } from "./admin-context";
import { ReasonDialog } from "./reason-dialog";
import { useRelativeTime } from "@/components/ui/use-relative-time";

const statusTone: Record<MemberStatus, PillTone> = { active: "success", suspended: "danger", deleting: "neutral" };

export function MembersView() {
  const t = useTranslations();
  const format = useFormatter();
  const rel = useRelativeTime();
  const { data } = useAdmin();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | MemberStatus>("all");
  const [selected, setSelected] = React.useState<string | null>(null);

  const rows = data.members.filter((m) => {
    const s = q.trim().toLowerCase();
    const matchQ = !s || m.email.toLowerCase().includes(s) || m.displayName.toLowerCase().includes(s) || m.uid.includes(s);
    return matchQ && (status === "all" || m.status === status);
  });
  const member = data.members.find((m) => m.uid === selected) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("nav.members")} description={t("admin.members.subtitle")} />
      <GlassCard className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="member-q" className="sr-only">
              {t("admin.members.search")}
            </label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <GlassInput id="member-q" className="pl-10" placeholder={t("admin.members.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label htmlFor="member-status" className="sr-only">
            {t("admin.members.status")}
          </label>
          <GlassSelect id="member-status" className="sm:w-48" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">{t("common.all")}</option>
            {(["active", "suspended", "deleting"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`status.member.${s}`)}
              </option>
            ))}
          </GlassSelect>
        </div>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[820px] text-left text-body">
            <caption className="sr-only">{t("nav.members")}</caption>
            <thead className="text-caption text-muted">
              <tr className="border-b border-glass-border">
                {["member", "joined", "lastSeen", "bots", "rooms", "usage", "cost", "status"].map((k) => (
                  <th key={k} scope="col" className="py-2 pr-3 font-medium">
                    {t(`admin.members.col.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.uid} className="border-b border-glass-border last:border-0">
                  <td className="py-2.5 pr-3">
                    <button type="button" onClick={() => setSelected(m.uid)} className="flex items-center gap-2.5 rounded-[8px] text-left hover:text-primary">
                      <Avatar label={m.displayName} seed={m.uid} />
                      <span>
                        <span className="block font-medium">{m.displayName}</span>
                        <span className="block text-caption text-muted">{m.email}</span>
                      </span>
                    </button>
                  </td>
                  <td className="py-2.5 pr-3 text-label">{format.dateTime(new Date(m.joinedAt), { dateStyle: "medium" })}</td>
                  <td className="py-2.5 pr-3 text-label">{rel(m.lastSeenAt)}</td>
                  <td className="py-2.5 pr-3 tabular">{m.bots}</td>
                  <td className="py-2.5 pr-3 tabular">{m.rooms}</td>
                  <td className="py-2.5 pr-3 tabular">{format.number(m.monthRequests)}</td>
                  <td className="py-2.5 pr-3 tabular">{format.number(m.monthCostMicros / 1_000_000, { style: "currency", currency: "USD" })}</td>
                  <td className="py-2.5 pr-3">
                    <StatusPill tone={statusTone[m.status]}>{t(`status.member.${m.status}`)}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-8 text-center text-body text-muted">{t("common.noResults")}</p>}
        </div>
        <p className="text-caption text-muted">{t("admin.members.noImpersonation")}</p>
      </GlassCard>
      <Sheet open={!!member} onOpenChange={(o) => !o && setSelected(null)} title={member?.displayName ?? ""} side="right" closeLabel={t("common.close")} widthClass="w-[min(480px,100vw)]">
        {member && <MemberDetail member={member} />}
      </Sheet>
    </div>
  );
}

function MemberDetail({ member }: { member: DemoMember }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { actions } = useAdmin();
  const [dialog, setDialog] = React.useState<"status" | "limit" | null>(null);
  const [limit, setLimit] = React.useState(member.dailyLimit);
  const suspend = member.status === "active";

  return (
    <div className="flex flex-col gap-5 px-5 pb-8 pt-3">
      <div className="flex items-center gap-3">
        <Avatar label={member.displayName} seed={member.uid} size={44} />
        <div className="min-w-0">
          <p className="truncate text-body text-muted">{member.email}</p>
          <code className="text-caption text-muted">{member.uid}</code>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {[
          [t("admin.members.col.bots"), member.bots],
          [t("admin.members.col.rooms"), member.rooms],
          [t("admin.members.col.usage"), format.number(member.monthRequests)],
          [t("admin.members.dailyLimit"), member.dailyLimit],
        ].map(([k, v]) => (
          <div key={String(k)} className="glass-card !rounded-[14px] p-3">
            <dt className="text-caption text-muted">{k}</dt>
            <dd className="text-section font-semibold tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <Button variant={suspend ? "danger" : "primary"} onClick={() => setDialog("status")} disabled={member.status === "deleting"}>
          {suspend ? t("admin.members.suspend") : t("admin.members.restore")}
        </Button>
        <Button variant="secondary" onClick={() => setDialog("limit")}>
          {t("admin.members.editLimit")}
        </Button>
      </div>
      <p className="text-caption text-muted">{t("admin.members.suspendNote")}</p>

      <ReasonDialog
        open={dialog === "status"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={suspend ? t("admin.members.suspend") : t("admin.members.restore")}
        description={member.email}
        confirmLabel={suspend ? t("admin.members.suspend") : t("admin.members.restore")}
        tone={suspend ? "danger" : "primary"}
        onConfirm={async (reason) => {
          await actions.setMemberStatus(member.uid, suspend ? "suspended" : "active", reason);
          toast(t("common.saved"));
        }}
      />
      <ReasonDialog
        open={dialog === "limit"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("admin.members.editLimit")}
        confirmLabel={t("common.save")}
        onConfirm={async (reason) => {
          await actions.setMemberLimit(member.uid, limit, reason);
          toast(t("common.saved"));
        }}
      >
        <Field id="member-limit" label={t("admin.members.dailyLimit")}>
          {(p) => <GlassInput {...p} type="number" min={1} max={10000} value={limit} onChange={(e) => setLimit(e.target.valueAsNumber || 1)} />}
        </Field>
      </ReasonDialog>
    </div>
  );
}

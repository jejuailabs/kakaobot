"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { GlassCard, StatusPill, type PillTone } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { GlassInput, GlassSelect } from "@/components/ui/field";
import { Modal } from "@/components/ui/primitives";
import { PageHeader } from "@/features/console/console-frame";
import type { ConversationStatus, DemoConversation } from "@/lib/shared/demo-admin";
import { maskedSummary, maskText } from "@/lib/shared/masking";
import { useAdmin } from "./admin-context";
import { ReasonDialog } from "./reason-dialog";

const tone: Record<ConversationStatus, PillTone> = { answered: "success", failed: "danger", unknown_delivery: "warning" };

export function ConversationsView() {
  const t = useTranslations();
  const format = useFormatter();
  const { data } = useAdmin();
  const [status, setStatus] = React.useState<"all" | ConversationStatus>("all");
  const [bot, setBot] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);

  const bots = [...new Set(data.conversations.map((c) => c.bot))];
  const rows = data.conversations.filter(
    (c) => (status === "all" || c.status === status) && (bot === "all" || c.bot === bot) && (!q || c.requestId.includes(q.trim())),
  );
  const current = data.conversations.find((c) => c.id === open) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("nav.conversations")} description={t("admin.conversations.subtitle")} />
      <GlassCard className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="c-q" className="sr-only">requestId</label>
            <GlassInput id="c-q" placeholder="requestId" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-bot" className="sr-only">{t("admin.conversations.bot")}</label>
            <GlassSelect id="c-bot" value={bot} onChange={(e) => setBot(e.target.value)}>
              <option value="all">{t("admin.conversations.allBots")}</option>
              {bots.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </GlassSelect>
          </div>
          <div>
            <label htmlFor="c-status" className="sr-only">{t("admin.members.status")}</label>
            <GlassSelect id="c-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">{t("common.all")}</option>
              {(["answered", "failed", "unknown_delivery"] as const).map((s) => (
                <option key={s} value={s}>{t(`status.conversation.${s}`)}</option>
              ))}
            </GlassSelect>
          </div>
        </div>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[860px] text-left text-body">
            <caption className="sr-only">{t("nav.conversations")}</caption>
            <thead className="text-caption text-muted">
              <tr className="border-b border-glass-border">
                {["time", "bot", "summary", "status", "latency", "tokens", "cost"].map((k) => (
                  <th key={k} scope="col" className="py-2 pr-3 font-medium">{t(`admin.conversations.col.${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-glass-border last:border-0">
                  <td className="py-2.5 pr-3 text-label">{format.dateTime(new Date(c.at), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="py-2.5 pr-3">
                    <span className="block font-medium">{c.bot}</span>
                    <span className="block text-caption text-muted">{c.workspace} · {c.room}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <button type="button" onClick={() => setOpen(c.id)} className="rounded-[6px] text-left text-label hover:text-primary hover:underline">
                      {maskedSummary(c.input)}
                    </button>
                  </td>
                  <td className="py-2.5 pr-3"><StatusPill tone={tone[c.status]}>{t(`status.conversation.${c.status}`)}</StatusPill></td>
                  <td className="py-2.5 pr-3 tabular">{format.number(c.latencyMs / 1000, { maximumFractionDigits: 1 })}s</td>
                  <td className="py-2.5 pr-3 tabular">{format.number(c.tokens)}</td>
                  <td className="py-2.5 pr-3 tabular">{format.number(c.costMicros / 1_000_000, { style: "currency", currency: "USD", maximumFractionDigits: 4 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-muted">{t("admin.conversations.policy")}</p>
      </GlassCard>
      {current && <ConversationDetail c={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ConversationDetail({ c, onClose }: { c: DemoConversation; onClose: () => void }) {
  const t = useTranslations();
  const { revealed, actions } = useAdmin();
  const [reveal, setReveal] = React.useState(false);
  const isRevealed = revealed.has(c.id);
  const show = (s: string) => (isRevealed ? s : maskText(s));

  return (
    <>
      <Modal open onOpenChange={(o) => !o && onClose()} title={`${c.bot} · ${c.requestId}`} closeLabel={t("common.close")} wide>
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 text-label sm:grid-cols-4">
            {[
              [t("admin.conversations.model"), c.model],
              ["promptVersion", `v${c.promptVersion}`],
              [t("admin.conversations.delivery"), t(`status.conversation.${c.status}`)],
              [t("admin.conversations.error"), c.errorCode ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="glass-card !rounded-[12px] p-3">
                <dt className="text-caption text-muted">{k}</dt>
                <dd className="font-semibold [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-label text-muted">
              {isRevealed ? <Eye className="size-4 text-warning" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
              {isRevealed ? t("admin.conversations.revealed") : t("admin.conversations.masked")}
            </p>
            {!isRevealed && (
              <Button size="sm" variant="secondary" onClick={() => setReveal(true)}>
                <Lock aria-hidden />
                {t("admin.conversations.reveal")}
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="ml-auto max-w-[85%] rounded-[14px] rounded-tr-[4px] bg-kakao px-3 py-2 text-body text-kakao-fg">{show(c.input)}</p>
            <p className="glass-solid max-w-[90%] rounded-[14px] rounded-tl-[4px] px-3 py-2 text-body">{c.output ? show(c.output) : t("admin.conversations.noOutput")}</p>
          </div>
          <p className="text-caption text-muted">{t("admin.conversations.noReasoning")}</p>
        </div>
      </Modal>
      <ReasonDialog
        open={reveal}
        onOpenChange={setReveal}
        title={t("admin.conversations.reveal")}
        description={t("admin.conversations.revealDesc")}
        confirmLabel={t("admin.conversations.reveal")}
        onConfirm={(reason) => actions.revealConversation(c.id, reason)}
      />
    </>
  );
}

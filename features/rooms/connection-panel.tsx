"use client";

import { CheckCircle2, Clock, FlaskConical, KeyRound, MessageSquareText, RefreshCw, UserRoundCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { ConnectionStepper } from "@/components/glass/connection-stepper";
import { DemoBadge, ErrorBanner, GlassCard } from "@/components/glass/glass-card";
import { PairingCodeCard } from "@/components/glass/pairing-code-card";
import { Button } from "@/components/ui/button";
import { Field, GlassInput, GlassSelect } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useConsole } from "@/features/console/console-context";
import type { Bot, Room } from "@/lib/shared/domain";
import { fieldErrors, joinRequestSchema } from "@/lib/shared/schemas";

/** 5초 poll, 탭 비활성 시 중지, 5분 후 수동 새로고침 (docs/03). */
export function usePolling(enabled: boolean, fn: () => void, intervalMs = 5000, maxMs = 300_000) {
  const [stopped, setStopped] = React.useState(false);
  const fnRef = React.useRef(fn);
  React.useEffect(() => {
    fnRef.current = fn;
  });
  React.useEffect(() => {
    if (!enabled || stopped) return;
    const started = Date.now();
    const h = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - started > maxMs) {
        setStopped(true);
        return;
      }
      fnRef.current();
    }, intervalMs);
    return () => window.clearInterval(h);
  }, [enabled, stopped, intervalMs, maxMs]);
  return { stopped, resume: () => setStopped(false) };
}

function stepIndex(bot: Bot) {
  switch (bot.state) {
    case "draft":
      return 0;
    case "awaiting_join":
      return 1;
    case "awaiting_code":
      return 2;
    default:
      return 5; // 모든 단계 완료
  }
}

function JoinRequestForm({ bot }: { bot: Bot }) {
  const t = useTranslations();
  const toast = useToast();
  const { actions, mode } = useConsole();
  const [url, setUrl] = React.useState(bot.roomUrl);
  const [roomLabel, setRoomLabel] = React.useState("");
  const [permission, setPermission] = React.useState(false);
  const [notice, setNotice] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { url, roomLabel, permissionConfirmed: permission, noticeConfirmed: notice };
    const parsed = joinRequestSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await actions.requestJoin(bot.id, parsed.data);
    setBusy(false);
    if (res.ok) toast(t("connection.requested"));
    else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setError(t(`errors.${res.error}`));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="rounded-[14px] bg-selected p-4 text-label leading-6">
        <p className="font-semibold">{t("connection.accountTitle")}</p>
        <p className="text-muted">
          {t("connection.accountDesc", { account: mode === "demo" ? "Katcha Bot (demo)" : "Katcha Bot" })}
        </p>
        <p className="mt-1 text-muted">{t("connection.manualNote")}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="jr-label" label={t("connection.roomLabel")} hint={t("connection.roomLabelHint")} error={err("roomLabel")}>
          {(p) => <GlassInput {...p} value={roomLabel} onChange={(e) => setRoomLabel(e.target.value)} maxLength={70} />}
        </Field>
        <Field id="jr-url" label={t("connection.roomUrl")} hint={t("connection.roomUrlHint")} error={err("url")}>
          {(p) => <GlassInput {...p} type="url" inputMode="url" placeholder="https://open.kakao.com/o/…" value={url} onChange={(e) => setUrl(e.target.value)} />}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-label font-medium">{t("connection.consentTitle")}</legend>
        <div className="rounded-[14px] border border-glass-border bg-input p-4 text-label leading-6 text-muted">
          <p className="font-semibold text-fg">{t("connection.loggingTitle")}</p>
          <ul className="mt-1 list-disc pl-5">
            <li>{t("connection.logging1")}</li>
            <li>{t("connection.logging2")}</li>
            <li>{t("connection.logging3")}</li>
          </ul>
        </div>
        {[
          { id: "jr-perm", checked: permission, set: setPermission, label: t("connection.permission"), key: "permissionConfirmed" },
          { id: "jr-notice", checked: notice, set: setNotice, label: t("connection.notice"), key: "noticeConfirmed" },
        ].map((c) => (
          <div key={c.id}>
            <label htmlFor={c.id} className="flex min-h-11 cursor-pointer items-start gap-3 text-body">
              <input
                id={c.id}
                type="checkbox"
                checked={c.checked}
                onChange={(e) => c.set(e.target.checked)}
                aria-invalid={errors[c.key] ? true : undefined}
                className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
              />
              <span>{c.label}</span>
            </label>
            {errors[c.key] && <p className="ml-8 text-caption font-medium text-danger">{t(errors[c.key])}</p>}
          </div>
        ))}
      </fieldset>
      {error && <ErrorBanner title={error} />}
      <Button type="submit" loading={busy} className="self-start">
        {t("connection.submitRequest")}
      </Button>
    </form>
  );
}

function RetentionSelect({ room }: { room: Room }) {
  const t = useTranslations();
  const toast = useToast();
  const { actions } = useConsole();
  return (
    <Field id={`ret-${room.id}`} label={t("rooms.retention")} hint={t("rooms.retentionHint")}>
      {(p) => (
        <GlassSelect
          {...p}
          value={room.retentionDays}
          onChange={async (e) => {
            const res = await actions.setRetention(room.id, Number(e.target.value) as Room["retentionDays"]);
            toast(res.ok ? t("common.saved") : t(`errors.${res.error}`), res.ok ? "success" : "error");
          }}
        >
          {[7, 30, 90].map((d) => (
            <option key={d} value={d}>
              {t("common.days", { count: d })}
            </option>
          ))}
        </GlassSelect>
      )}
    </Field>
  );
}

export function ConnectionPanel({ bot }: { bot: Bot }) {
  const t = useTranslations();
  const toast = useToast();
  const { snapshot, actions, mode } = useConsole();
  const code = snapshot.pairingCodes.find((p) => p.botId === bot.id);
  const room = snapshot.rooms.find((r) => r.botId === bot.id);
  const jr = snapshot.joinRequests.find((j) => j.botId === bot.id);
  const [issuing, setIssuing] = React.useState(false);
  const [issueError, setIssueError] = React.useState<string | null>(null);
  const waiting = bot.state === "awaiting_join" || bot.state === "awaiting_code";
  // live 에서는 GET /api/v1/bots/:id/connection 을 poll 한다 (S4). demo 는 로컬 상태라 no-op.
  const poll = usePolling(waiting && mode === "live", () => {});

  const steps = [
    { key: "request", label: t("connection.steps.request") },
    { key: "operator", label: t("connection.steps.operator") },
    { key: "code", label: t("connection.steps.code") },
    { key: "send", label: t("connection.steps.send") },
    { key: "done", label: t("connection.steps.done") },
  ];

  async function issue() {
    setIssuing(true);
    setIssueError(null);
    const res = await actions.issuePairingCode(bot.id);
    setIssuing(false);
    if (res.ok) toast(t("connection.codeIssued"));
    else setIssueError(t(`errors.${res.error}`));
  }

  return (
    <div className="flex flex-col gap-5">
      <GlassCard>
        <ConnectionStepper steps={steps} current={stepIndex(bot)} label={t("connection.progress")} />
      </GlassCard>

      {bot.state === "draft" && (
        <GlassCard>
          <h2 className="mb-1 text-section font-semibold">{t("connection.requestTitle")}</h2>
          <p className="mb-5 text-body text-muted">{t("connection.requestDesc")}</p>
          <JoinRequestForm bot={bot} />
        </GlassCard>
      )}

      {bot.state === "awaiting_join" && (
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <h2 className="text-section font-semibold">{t("connection.waitingOperator")}</h2>
              <p className="mt-1 text-body text-muted">{t("connection.waitingOperatorDesc")}</p>
              {jr && <p className="mt-2 text-label text-muted">{t("connection.requestedRoom", { room: jr.roomLabel })}</p>}
            </div>
          </div>
          {mode === "demo" && actions.simulate && (
            <DemoSimulate label={t("connection.simulateOperator")} onClick={() => actions.simulate?.operatorJoined(bot.id)} icon={<UserRoundCheck aria-hidden />} />
          )}
        </GlassCard>
      )}

      {bot.state === "awaiting_code" && (
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-section font-semibold">{t("connection.codeStepTitle")}</h2>
              <p className="mt-1 text-body text-muted">{t("connection.codeStepDesc")}</p>
            </div>
          </div>
          {code ? (
            <PairingCodeCard code={code.code} expiresAt={code.expiresAt} onReissue={issue} reissuing={issuing} />
          ) : (
            <Button onClick={issue} loading={issuing} className="self-start">
              <KeyRound aria-hidden />
              {t("connection.issue")}
            </Button>
          )}
          {issueError && <ErrorBanner title={issueError} />}
          {code && mode === "demo" && actions.simulate && (
            <DemoSimulate label={t("connection.simulateSend")} onClick={() => actions.simulate?.codeSentInRoom(bot.id)} icon={<MessageSquareText aria-hidden />} />
          )}
        </GlassCard>
      )}

      {waiting && poll.stopped && (
        <ErrorBanner
          tone="info"
          icon="retry"
          title={t("connection.pollStopped")}
          action={
            <Button size="sm" variant="secondary" onClick={poll.resume}>
              <RefreshCw aria-hidden />
              {t("common.refresh")}
            </Button>
          }
        />
      )}

      {(bot.state === "active" || bot.state === "paused") && room && (
        <GlassCard className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <div>
              <h2 className="text-section font-semibold">{t("connection.connectedTitle", { room: room.label })}</h2>
              <p className="mt-1 text-body text-muted">{t("connection.connectedDesc", { trigger: bot.trigger })}</p>
            </div>
          </div>
          <p className="rounded-[12px] bg-input p-3 font-mono text-label">
            {bot.trigger} {t("connection.sampleQuestion")}
          </p>
          <div className="max-w-xs">
            <RetentionSelect room={room} />
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function DemoSimulate({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-dashed border-[color-mix(in_srgb,var(--accent)_55%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-label text-muted">
        <FlaskConical className="size-4 text-accent" aria-hidden />
        <DemoBadge label={t("common.demo")} />
        {t("connection.simulateNote")}
      </p>
      <Button variant="outline" size="sm" onClick={onClick}>
        {icon}
        {label}
      </Button>
    </div>
  );
}

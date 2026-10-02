"use client";

import { ArrowLeft, Bot as BotIcon, FlaskConical, Pause, Play, Save, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { ConfirmDialog } from "@/components/glass/confirm-dialog";
import { CardTitle, EmptyState, ErrorBanner, GlassCard, StatusPill } from "@/components/glass/glass-card";
import { Avatar } from "@/components/glass/room-row";
import { Button } from "@/components/ui/button";
import { Field, GlassTextarea } from "@/components/ui/field";
import { Modal, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useConsole } from "@/features/console/console-context";
import { ConnectionPanel } from "@/features/rooms/connection-panel";
import { Link, useRouter } from "@/i18n/navigation";
import { BOT_LIMITS, type Bot } from "@/lib/shared/domain";
import type { BotInput } from "@/lib/shared/schemas";
import { BasicFields, ResponseFields, RolesFields, TestChat, useErr } from "./bot-form-fields";
import { botStateTone } from "./status";
import { useRelativeTime } from "@/components/ui/use-relative-time";

const TABS = ["overview", "roles", "prompt", "connection", "history"] as const;
type Tab = (typeof TABS)[number];

function toInput(b: Bot): BotInput {
  return {
    name: b.name,
    description: b.description,
    roomUrl: b.roomUrl,
    locale: b.locale,
    timezone: b.timezone,
    roles: b.roles,
    faq: b.faq,
    customPrompt: b.customPrompt,
    trigger: b.trigger,
    tone: b.tone,
    length: b.length,
    replyLocale: b.replyLocale,
    modelId: b.modelId,
    dailyLimit: b.dailyLimit,
  };
}

function useUnsavedGuard(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}

export function BotDetailView({ botId }: { botId: string }) {
  const t = useTranslations();
  const { snapshot, href } = useConsole();
  const bot = snapshot.bots.find((b) => b.id === botId);

  if (!bot) {
    return (
      <GlassCard>
        <EmptyState
          icon={<BotIcon />}
          title={t("errors.botNotFound")}
          description={t("errors.botNotFoundDesc")}
          action={
            <Button asChild variant="secondary">
              <Link href={href("bots")}>{t("bots.title")}</Link>
            </Button>
          }
        />
      </GlassCard>
    );
  }
  return <BotDetail key={bot.id} bot={bot} />;
}

function BotDetail({ bot }: { bot: Bot }) {
  const t = useTranslations();
  const format = useFormatter();
  const rel = useRelativeTime();
  const toast = useToast();
  const router = useRouter();
  const search = useSearchParams();
  const { snapshot, actions, href } = useConsole();

  const initialTab = (TABS as readonly string[]).includes(search.get("tab") ?? "") ? (search.get("tab") as Tab) : "overview";
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [values, setValues] = React.useState<BotInput>(() => toInput(bot));
  const [baseVersion, setBaseVersion] = React.useState(bot.version);
  const [baseValues, setBaseValues] = React.useState<BotInput>(() => toInput(bot));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const errText = useErr(errors);
  const [saving, setSaving] = React.useState(false);
  const [conflict, setConflict] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [pausing, setPausing] = React.useState(false);
  const [testOpen, setTestOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const saved = toInput(bot);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseValues);
  useUnsavedGuard(dirty);

  // 편집 중이 아니면 서버(또는 연결 진행)로 바뀐 최신 버전을 그대로 따라간다.
  // 편집 중에 버전이 바뀌면 저장 시 409 conflict 로 알린다.
  React.useEffect(() => {
    if (!dirty && baseVersion !== bot.version) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 변경 동기화
      setBaseValues(saved);
      setBaseVersion(bot.version);
      setValues(saved);
    }
  }, [dirty, baseVersion, bot.version, saved]);

  const onChange = (patch: Partial<BotInput>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const n = { ...e };
      for (const k of Object.keys(patch)) delete n[k];
      return n;
    });
  };

  async function save() {
    setSaving(true);
    setSaveError(null);
    const res = await actions.updateBot(bot.id, values, baseVersion);
    setSaving(false);
    if (res.ok) {
      setBaseVersion(res.data.version);
      setBaseValues(toInput(res.data));
      setValues(toInput(res.data));
      setConflict(false);
      toast(t("common.saved"));
      return;
    }
    if (res.error === "conflict") setConflict(true);
    else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setSaveError(t(`errors.${res.error}`));
    }
  }

  function reloadLatest() {
    setValues(toInput(bot));
    setBaseValues(toInput(bot));
    setBaseVersion(bot.version);
    setConflict(false);
    setErrors({});
  }

  async function togglePause() {
    setPausing(true);
    const res = await actions.setPaused(bot.id, bot.state === "active", bot.version);
    setPausing(false);
    if (res.ok) {
      setBaseVersion(res.data.version);
      toast(res.data.state === "paused" ? t("bot.pausedToast") : t("bot.resumedToast"));
    } else toast(t(`errors.${res.error}`), "error");
  }

  async function remove() {
    const res = await actions.deleteBot(bot.id);
    if (res.ok) {
      setDeleteOpen(false);
      toast(t("bot.deleted"));
      router.push(href("bots"));
    } else toast(t(`errors.${res.error}`), "error");
  }

  const prompts = snapshot.prompts.filter((p) => p.botId === bot.id).sort((a, b) => b.version - a.version);
  const activities = snapshot.activities.filter((a) => a.botId === bot.id);
  const canPause = bot.state === "active" || bot.state === "paused";
  const editTab = tab === "overview" || tab === "roles" || tab === "prompt";

  return (
    <div className="flex flex-col gap-5 pb-20">
      <Link href={href("bots")} className="inline-flex w-fit items-center gap-1.5 rounded-[8px] text-label text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        {t("bots.title")}
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar label={bot.name} seed={bot.id} size={48} />
          <div className="min-w-0">
            <h1 className="text-heading font-[650] [overflow-wrap:anywhere]">{bot.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill tone={botStateTone[bot.state]}>{t(`status.bot.${bot.state}`)}</StatusPill>
              <span className="text-caption text-muted">{t("bot.updated", { time: rel(bot.updatedAt) })}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setTestOpen(true)}>
            <FlaskConical aria-hidden />
            {t("bot.test")}
          </Button>
          {canPause && (
            <Button variant="secondary" onClick={togglePause} loading={pausing}>
              {!pausing && (bot.state === "active" ? <Pause aria-hidden /> : <Play aria-hidden />)}
              {bot.state === "active" ? t("bot.pause") : t("bot.resume")}
            </Button>
          )}
        </div>
      </div>

      {bot.state === "paused" && <ErrorBanner tone="info" title={t("bot.pausedBanner")} description={t("bot.pausedBannerDesc")} />}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList aria-label={t("bot.tabsLabel")}>
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`bot.tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5 flex flex-col gap-5">
          <GlassCard>
            <CardTitle>{t("bot.basicInfo")}</CardTitle>
            <BasicFields values={values} onChange={onChange} errors={errors} />
          </GlassCard>
          <div className="grid gap-4 md:grid-cols-3">
            <GlassCard as="div">
              <p className="text-label text-muted">{t("bot.room")}</p>
              <p className="mt-1 font-semibold">{bot.roomLabel ?? t("bots.noRoom")}</p>
            </GlassCard>
            <GlassCard as="div">
              <p className="text-label text-muted">{t("bot.messages30d")}</p>
              <p className="mt-1 text-kpi font-semibold tabular">{format.number(bot.messages30d)}</p>
            </GlassCard>
            <GlassCard as="div">
              <p className="text-label text-muted">{t("bot.promptVersion")}</p>
              <p className="mt-1 text-kpi font-semibold tabular">v{bot.promptVersion}</p>
            </GlassCard>
          </div>
          <GlassCard className="border-[color-mix(in_srgb,var(--danger)_40%,transparent)]">
            <CardTitle>{t("bot.dangerZone")}</CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body text-muted">{t("bot.deleteDesc")}</p>
              <Button variant="danger" onClick={() => setDeleteOpen(true)} className="shrink-0">
                <Trash2 aria-hidden />
                {t("bot.delete")}
              </Button>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="roles" className="mt-5 flex flex-col gap-5">
          <GlassCard>
            <CardTitle>{t("bot.tabs.roles")}</CardTitle>
            <RolesFields values={values} onChange={onChange} errors={errors} />
          </GlassCard>
          <GlassCard>
            <CardTitle>{t("wizard.steps.response")}</CardTitle>
            <ResponseFields values={values} onChange={onChange} errors={errors} />
          </GlassCard>
        </TabsContent>

        <TabsContent value="prompt" className="mt-5 flex flex-col gap-5">
          <GlassCard>
            <CardTitle>{t("bot.promptTitle", { version: bot.promptVersion })}</CardTitle>
            <p className="mb-4 text-body text-muted">{t("bot.promptDesc")}</p>
            <div className="flex flex-col gap-5">
              <Field id="p-custom" label={t("wizard.roles.custom")} counter={{ value: values.customPrompt.length, max: BOT_LIMITS.customPromptMax }} error={errText("customPrompt")}>
                {(p) => <GlassTextarea {...p} className="min-h-48" value={values.customPrompt} onChange={(e) => onChange({ customPrompt: e.target.value })} />}
              </Field>
              <Field id="p-faq" label={t("wizard.roles.faq")} counter={{ value: values.faq.length, max: BOT_LIMITS.faqMax }} error={errText("faq")}>
                {(p) => <GlassTextarea {...p} value={values.faq} onChange={(e) => onChange({ faq: e.target.value })} />}
              </Field>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="connection" className="mt-5">
          <ConnectionPanel bot={bot} />
        </TabsContent>

        <TabsContent value="history" className="mt-5 grid gap-5 lg:grid-cols-2">
          <GlassCard>
            <CardTitle>{t("bot.promptHistory")}</CardTitle>
            <ol className="flex flex-col gap-3">
              {prompts.map((p) => (
                <li key={p.id} className="glass-card !rounded-[14px] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">v{p.version}</span>
                    <time className="text-caption text-muted" dateTime={p.createdAt}>
                      {format.dateTime(new Date(p.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-3 text-label text-muted">{p.body || t("bot.emptyPrompt")}</p>
                </li>
              ))}
            </ol>
          </GlassCard>
          <GlassCard>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
            {activities.length === 0 ? (
              <p className="text-body text-muted">{t("dashboard.noActivity")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--glass-border)]">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-body">
                    <span>{t(`dashboard.activity.${a.kind}`, { bot: a.botName })}</span>
                    <time className="shrink-0 text-caption text-muted" dateTime={a.at}>
                      {rel(a.at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-caption text-muted">{t("bot.historyPrivacy")}</p>
          </GlassCard>
        </TabsContent>
      </Tabs>

      {/* 명시적 저장: 편집 탭에서 변경이 있을 때 sticky footer */}
      {editTab && (dirty || conflict || saveError) && (
        <div className="sticky bottom-4 z-20">
          <div className="glass-solid flex flex-col gap-3 rounded-[18px] p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
            {conflict ? (
              <p className="text-body font-medium text-warning" role="alert">
                {t("errors.conflict")}
              </p>
            ) : saveError ? (
              <p className="text-body font-medium text-danger" role="alert">
                {saveError}
              </p>
            ) : (
              <p className="text-body text-muted">{t("bot.unsaved")}</p>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={reloadLatest} disabled={saving}>
                {conflict ? t("bot.loadLatest") : t("common.cancel")}
              </Button>
              {!conflict && (
                <Button onClick={save} loading={saving}>
                  {!saving && <Save aria-hidden />}
                  {t("common.save")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal open={testOpen} onOpenChange={setTestOpen} title={t("bot.test")} closeLabel={t("common.close")}>
        <TestChat botId={bot.id} botName={bot.name} />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("bot.deleteConfirmTitle", { name: bot.name })}
        description={t("bot.deleteConfirmDesc")}
        confirmLabel={t("bot.delete")}
        onConfirm={remove}
      />
    </div>
  );
}

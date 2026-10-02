"use client";

import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { GlassCard, StatusPill, type PillTone } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { Field, GlassSelect, GlassTextarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CUSTOM_PROMPT_MAX, PALETTES, SCENES, SEASONS, type GenJobStatus, type GenOptions } from "@/lib/shared/appearance-gen";
import { cn } from "@/lib/shared/cn";
import { useAdmin } from "./admin-context";

const STATUS_TONE: Record<GenJobStatus, PillTone> = { queued: "info", generating: "info", processing: "info", ready: "success", failed: "danger" };
const usd = (micros: number) => `$${(micros / 1_000_000).toFixed(micros < 1_000_000 ? 3 : 2)}`;

/** AI 배경 생성 (docs/07). provider 미설정·demo 에서는 미설정으로 표시하고 업로드만 쓴다. 결과는 초안 — 적용은 별도. */
export function AiBackgroundCard({ theme, onCreated }: { theme: "light" | "dark"; onCreated: (assetId: string) => void }) {
  const t = useTranslations("admin.appearance");
  const tc = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { data, actions } = useAdmin();
  const info = data.imageGen;
  const configured = Boolean(info?.configured && actions.generateBackground);
  const [opts, setOpts] = React.useState<Omit<GenOptions, "theme">>({ scene: "lake", palette: "lavender", season: "any", custom: "" });
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // 한 번 누른 요청은 끝날 때까지 같은 requestId — 중복 job 이 생기지 않는다
  const requestRef = React.useRef<string | null>(null);

  async function run() {
    if (!actions.generateBackground || pending) return;
    setError(null);
    setPending(true);
    requestRef.current ??= crypto.randomUUID();
    const r = await actions.generateBackground(requestRef.current, { ...opts, theme });
    requestRef.current = null;
    setPending(false);
    if ("error" in r) return setError(r.error.startsWith("admin.") || r.error.startsWith("errors.") ? tc(r.error) : tc("errors.network"));
    if (r.job.status === "ready" && r.job.assetId) {
      toast(t("genReady"));
      onCreated(r.job.assetId);
    } else {
      setError(t(`genError.${r.job.error === "unknown" || r.job.error === "moderation" || r.job.error === "processing" ? r.job.error : "other"}`));
    }
  }

  return (
    <GlassCard className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-accent" aria-hidden />
          {t("aiTitle")}
        </p>
        <StatusPill tone={configured ? "success" : "neutral"}>{configured ? t("aiReady") : tc("common.notConfigured")}</StatusPill>
      </div>
      {!configured ? (
        <p className="text-caption text-muted">{t("aiUnconfigured")}</p>
      ) : (
        <p className="text-caption text-muted">{t("aiNote", { theme: tc(`theme.${theme}`) })}</p>
      )}
      <fieldset disabled={!configured || pending} className="flex flex-col gap-3 disabled:opacity-60">
        <legend className="sr-only">{t("aiTitle")}</legend>
        <div role="radiogroup" aria-label={t("scene")} className="flex flex-wrap gap-1.5">
          {SCENES.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={opts.scene === k}
              onClick={() => setOpts((o) => ({ ...o, scene: k }))}
              className={cn("min-h-8 rounded-full border border-glass-border px-2.5 py-1 text-caption text-muted", opts.scene === k && "border-transparent bg-primary font-semibold text-primary-fg")}
            >
              {t(`scenes.${k}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="ap-palette" label={t("palette")}>
            {(p) => (
              <GlassSelect {...p} value={opts.palette} onChange={(e) => setOpts((o) => ({ ...o, palette: e.target.value as GenOptions["palette"] }))}>
                {PALETTES.map((k) => (
                  <option key={k} value={k}>{t(`palettes.${k}`)}</option>
                ))}
              </GlassSelect>
            )}
          </Field>
          <Field id="ap-season" label={t("season")}>
            {(p) => (
              <GlassSelect {...p} value={opts.season} onChange={(e) => setOpts((o) => ({ ...o, season: e.target.value as GenOptions["season"] }))}>
                {SEASONS.map((k) => (
                  <option key={k} value={k}>{t(`seasons.${k}`)}</option>
                ))}
              </GlassSelect>
            )}
          </Field>
        </div>
        <Field id="ap-custom" label={t("customPrompt")} counter={{ value: opts.custom.length, max: CUSTOM_PROMPT_MAX }}>
          {(p) => <GlassTextarea {...p} rows={2} maxLength={CUSTOM_PROMPT_MAX} value={opts.custom} placeholder={t("customPlaceholder")} onChange={(e) => setOpts((o) => ({ ...o, custom: e.target.value }))} />}
        </Field>
      </fieldset>
      <Button variant="secondary" disabled={!configured || pending} onClick={() => void run()} aria-busy={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
        {pending ? t("generating") : t("generate")}
      </Button>
      <p aria-live="polite" className="sr-only">{pending ? t("generating") : ""}</p>
      {error && <p role="alert" className="text-caption font-medium text-danger">{error}</p>}
      {info && configured && (
        <>
          <p className="text-caption text-muted tabular">
            {t("genUsage", { count: info.monthCount, cost: usd(info.monthCostMicros), budget: usd(info.budgetMicros) })} · {info.model} ({info.quality})
          </p>
          {info.jobs.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-caption">
              {info.jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-muted">
                    {format.dateTime(new Date(j.createdAt), { dateStyle: "short", timeStyle: "short" })} · {tc(`theme.${j.theme}`)} · {usd(j.costMicros)}
                  </span>
                  <StatusPill tone={STATUS_TONE[j.status]}>{t(`genStatus.${j.status}`)}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </GlassCard>
  );
}

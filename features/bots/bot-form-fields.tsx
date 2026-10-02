"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { DemoBadge } from "@/components/glass/glass-card";
import { RoleCard } from "@/components/glass/role-card";
import { Button } from "@/components/ui/button";
import { Field, GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/field";
import { useConsole } from "@/features/console/console-context";
import { cn } from "@/lib/shared/cn";
import { BOT_LIMITS, LENGTHS, REPLY_LOCALES, ROLE_IDS, TONES, type RoleId } from "@/lib/shared/domain";
import type { BotInput } from "@/lib/shared/schemas";

export type FormProps = {
  values: BotInput;
  onChange: (patch: Partial<BotInput>) => void;
  errors: Record<string, string>;
};

export const TIMEZONES = ["Asia/Seoul", "Asia/Tokyo", "UTC", "America/Los_Angeles", "America/New_York", "Europe/London"];

export function defaultBotInput(locale: string): BotInput {
  const l = (REPLY_LOCALES as readonly string[]).includes(locale) ? (locale as BotInput["locale"]) : "ko";
  return {
    name: "",
    description: "",
    roomUrl: "",
    locale: l,
    timezone: l === "ja" ? "Asia/Tokyo" : l === "en" ? "UTC" : "Asia/Seoul",
    roles: ["qa"],
    faq: "",
    customPrompt: "",
    trigger: "!AI",
    tone: "friendly",
    length: "normal",
    replyLocale: l,
    modelId: "",
    dailyLimit: 100,
  };
}

export function useErr(errors: Record<string, string>) {
  const t = useTranslations("validation");
  return (key: string) => {
    const k = errors[key];
    if (!k) return null;
    return t(k.replace(/^validation\./, ""), {
      min: BOT_LIMITS.nameMin,
      max: BOT_LIMITS.nameMax,
      rolesMin: BOT_LIMITS.rolesMin,
      rolesMax: BOT_LIMITS.rolesMax,
      faqMax: BOT_LIMITS.faqMax.toLocaleString(),
      customMax: BOT_LIMITS.customPromptMax.toLocaleString(),
      descMax: BOT_LIMITS.descriptionMax,
    });
  };
}

export function BasicFields({ values, onChange, errors }: FormProps) {
  const t = useTranslations("wizard.basic");
  const tl = useTranslations("locale");
  const err = useErr(errors);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field id="bot-name" label={t("name")} hint={t("nameHint")} error={err("name")} counter={{ value: values.name.length, max: BOT_LIMITS.nameMax }} className="md:col-span-2">
        {(p) => <GlassInput {...p} value={values.name} maxLength={BOT_LIMITS.nameMax + 10} onChange={(e) => onChange({ name: e.target.value })} autoComplete="off" />}
      </Field>
      <Field id="bot-desc" label={t("description")} error={err("description")} counter={{ value: values.description.length, max: BOT_LIMITS.descriptionMax }} className="md:col-span-2">
        {(p) => <GlassTextarea {...p} className="min-h-24" value={values.description} onChange={(e) => onChange({ description: e.target.value })} />}
      </Field>
      <Field id="bot-url" label={t("roomUrl")} hint={t("roomUrlHint")} error={err("roomUrl")} className="md:col-span-2">
        {(p) => <GlassInput {...p} type="url" inputMode="url" placeholder="https://open.kakao.com/o/…" value={values.roomUrl} onChange={(e) => onChange({ roomUrl: e.target.value })} />}
      </Field>
      <Field id="bot-locale" label={t("locale")}>
        {(p) => (
          <GlassSelect {...p} value={values.locale} onChange={(e) => onChange({ locale: e.target.value as BotInput["locale"] })}>
            {REPLY_LOCALES.map((l) => (
              <option key={l} value={l}>
                {tl(l)}
              </option>
            ))}
          </GlassSelect>
        )}
      </Field>
      <Field id="bot-tz" label={t("timezone")}>
        {(p) => (
          <GlassSelect {...p} value={values.timezone} onChange={(e) => onChange({ timezone: e.target.value })}>
            {TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </GlassSelect>
        )}
      </Field>
    </div>
  );
}

export function RolesFields({ values, onChange, errors }: FormProps) {
  const t = useTranslations("wizard.roles");
  const { snapshot } = useConsole();
  const err = useErr(errors);

  function toggle(role: RoleId) {
    const has = values.roles.includes(role);
    if (has) onChange({ roles: values.roles.filter((r) => r !== role) });
    else if (values.roles.length < BOT_LIMITS.rolesMax) onChange({ roles: [...values.roles, role] });
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-1 text-label font-medium">{t("legend")}</legend>
        <p className="mb-3 text-caption text-muted">{t("hint", { min: BOT_LIMITS.rolesMin, max: BOT_LIMITS.rolesMax })}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ROLE_IDS.map((role) => {
            const searchDisabled = role === "search" && !snapshot.searchConfigured;
            const full = !values.roles.includes(role) && values.roles.length >= BOT_LIMITS.rolesMax;
            return (
              <RoleCard
                key={role}
                role={role}
                selected={values.roles.includes(role)}
                disabled={searchDisabled || full}
                disabledReason={searchDisabled ? t("searchDisabled") : full ? t("maxReached", { max: BOT_LIMITS.rolesMax }) : undefined}
                onToggle={() => toggle(role)}
              />
            );
          })}
        </div>
        {err("roles") && <p className="mt-2 text-caption font-medium text-danger">{err("roles")}</p>}
      </fieldset>

      {values.roles.includes("faq") && (
        <Field id="bot-faq" label={t("faq")} hint={t("faqHint")} error={err("faq")} counter={{ value: values.faq.length, max: BOT_LIMITS.faqMax }}>
          {(p) => <GlassTextarea {...p} value={values.faq} onChange={(e) => onChange({ faq: e.target.value })} placeholder={t("faqPlaceholder")} />}
        </Field>
      )}
      {values.roles.includes("custom") && (
        <Field id="bot-custom" label={t("custom")} hint={t("customHint")} error={err("customPrompt")} counter={{ value: values.customPrompt.length, max: BOT_LIMITS.customPromptMax }}>
          {(p) => <GlassTextarea {...p} value={values.customPrompt} onChange={(e) => onChange({ customPrompt: e.target.value })} placeholder={t("customPlaceholder")} />}
        </Field>
      )}
      {values.roles.includes("notice") && <p className="rounded-[12px] bg-selected p-3 text-label text-muted">{t("noticeNote")}</p>}
    </div>
  );
}

function ChoiceGroup<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  label,
}: {
  name: string;
  legend: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-label font-medium">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <label
            key={o}
            className={cn(
              "glass-card flex h-11 cursor-pointer items-center justify-center !rounded-[12px] px-2 text-center text-label font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
              value === o && "glass-selected text-primary",
            )}
          >
            <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} className="sr-only" />
            {label(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ResponseFields({ values, onChange, errors }: FormProps) {
  const t = useTranslations();
  const { snapshot } = useConsole();
  const err = useErr(errors);
  const models = snapshot.models.filter((m) => m.configured);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field id="bot-trigger" label={t("wizard.response.trigger")} hint={t("wizard.response.triggerHint")} error={err("trigger")}>
        {(p) => <GlassInput {...p} value={values.trigger} onChange={(e) => onChange({ trigger: e.target.value })} autoComplete="off" />}
      </Field>
      <Field id="bot-model" label={t("wizard.response.model")} error={err("modelId")} hint={models.length === 0 ? t("wizard.response.noModels") : undefined}>
        {(p) => (
          <GlassSelect {...p} value={values.modelId} onChange={(e) => onChange({ modelId: e.target.value })} disabled={models.length === 0}>
            <option value="">{t("wizard.response.modelPlaceholder")}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </GlassSelect>
        )}
      </Field>
      <ChoiceGroup name="tone" legend={t("bot.tone")} options={TONES} value={values.tone} onChange={(v) => onChange({ tone: v })} label={(v) => t(`tone.${v}`)} />
      <ChoiceGroup name="length" legend={t("bot.length")} options={LENGTHS} value={values.length} onChange={(v) => onChange({ length: v })} label={(v) => t(`length.${v}`)} />
      <Field id="bot-reply-locale" label={t("wizard.response.replyLocale")}>
        {(p) => (
          <GlassSelect {...p} value={values.replyLocale} onChange={(e) => onChange({ replyLocale: e.target.value as BotInput["replyLocale"] })}>
            {REPLY_LOCALES.map((l) => (
              <option key={l} value={l}>
                {t(`locale.${l}`)}
              </option>
            ))}
          </GlassSelect>
        )}
      </Field>
      <Field id="bot-limit" label={t("wizard.response.dailyLimit")} hint={t("wizard.response.dailyLimitHint")} error={err("dailyLimit")}>
        {(p) => (
          <GlassInput
            {...p}
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={Number.isFinite(values.dailyLimit) ? values.dailyLimit : ""}
            onChange={(e) => onChange({ dailyLimit: e.target.valueAsNumber })}
          />
        )}
      </Field>
      <p className="rounded-[12px] bg-selected p-3 text-label text-muted md:col-span-2">{t("wizard.response.noAutoReply")}</p>
    </div>
  );
}

/** 테스트 질문. live 에서는 실제 비용·사용량이 적용되고, demo 는 badge 로 구분한다. */
export function TestChat({ botId, botName }: { botId: string | null; botName: string }) {
  const t = useTranslations();
  const { mode, actions } = useConsole();
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [answer, setAnswer] = React.useState<{ text: string; demo: boolean } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await actions.testReply(botId, q, botName || t("wizard.untitled"));
    setBusy(false);
    if (res.ok) setAnswer(res.data);
    else setError(t(`errors.${res.error}`));
  }

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{t("test.title")}</p>
        {mode === "demo" && <DemoBadge label={t("common.demo")} />}
      </div>
      <p className="text-caption text-muted">{mode === "demo" ? t("test.demoNote") : t("test.costNote")}</p>
      <form onSubmit={run} className="flex gap-2">
        <label htmlFor={`test-q-${botId ?? "new"}`} className="sr-only">
          {t("test.label")}
        </label>
        <GlassInput id={`test-q-${botId ?? "new"}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("test.placeholder")} maxLength={BOT_LIMITS.questionMax} />
        <Button type="submit" loading={busy} disabled={!q.trim()} aria-label={t("test.send")} className="shrink-0">
          {!busy && <Send aria-hidden />}
          <span className="hidden sm:inline">{t("test.send")}</span>
        </Button>
      </form>
      <div aria-live="polite">
        {answer && (
          <div className="flex flex-col gap-2">
            <p className="ml-auto max-w-[85%] rounded-[14px] rounded-tr-[4px] bg-kakao px-3 py-2 text-label text-kakao-fg">{q}</p>
            <p className="glass-solid max-w-[90%] rounded-[14px] rounded-tl-[4px] px-3 py-2 text-label">{answer.text}</p>
          </div>
        )}
        {error && <p className="text-caption font-medium text-danger">{error}</p>}
      </div>
    </div>
  );
}

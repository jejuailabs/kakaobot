"use client";

import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { ConnectionStepper } from "@/components/glass/connection-stepper";
import { ErrorBanner, GlassCard } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConsole } from "@/features/console/console-context";
import { PageHeader } from "@/features/console/console-frame";
import { useRouter } from "@/i18n/navigation";
import { basicInfoSchema, fieldErrors, responseSchema, rolesSchema, type BotInput } from "@/lib/shared/schemas";
import { BasicFields, defaultBotInput, ResponseFields, RolesFields, TestChat } from "./bot-form-fields";

// localStorage 에는 draft ID 만 둔다. 내용(프롬프트 등)은 서버(demo 는 탭 저장소) draft 에 저장한다.
const DRAFT_ID_KEY = "katcha.wizardDraftId";

function readDraftId(): string | null {
  try {
    return window.localStorage.getItem(DRAFT_ID_KEY);
  } catch {
    return null;
  }
}
function writeDraftId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(DRAFT_ID_KEY, id);
    else window.localStorage.removeItem(DRAFT_ID_KEY);
  } catch {}
}

const STEP_KEYS = ["basic", "roles", "response", "review"] as const;

export function WizardView() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { snapshot, actions, href } = useConsole();

  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(0);
  const [values, setValues] = React.useState<BotInput>(() => defaultBotInput(locale));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [restored, setRestored] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  // 첫 렌더 후 draft 복구 (새로고침 대응)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = readDraftId();
      if (id) {
        const res = await actions.loadDraft(id);
        if (!cancelled && res.ok) {
          setDraftId(id);
          setValues({ ...defaultBotInput(locale), ...res.data.values });
          setStep(Math.min(res.data.step, 3));
          setRestored(true);
          return;
        }
      }
      if (!cancelled) {
        const fresh = crypto.randomUUID();
        writeDraftId(fresh);
        setDraftId(fresh);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 첫 지원 모델 기본 선택
  React.useEffect(() => {
    if (!values.modelId) {
      const first = snapshot.models.find((m) => m.configured);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 선택 가능한 첫 모델로 초기화
      if (first) setValues((v) => ({ ...v, modelId: first.id }));
    }
  }, [snapshot.models, values.modelId]);

  // 변경 사항을 draft 에 저장 (debounce)
  React.useEffect(() => {
    if (!draftId) return;
    const h = window.setTimeout(() => void actions.saveDraft({ id: draftId, step, values }), 400);
    return () => window.clearTimeout(h);
  }, [draftId, step, values, actions]);

  const onChange = (patch: Partial<BotInput>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  function validate(s: number): boolean {
    const schema = s === 0 ? basicInfoSchema : s === 1 ? rolesSchema : s === 2 ? responseSchema : null;
    if (!schema) return true;
    const res = schema.safeParse(values);
    if (res.success) {
      setErrors({});
      return true;
    }
    setErrors(fieldErrors(res.error));
    return false;
  }

  function go(next: number) {
    if (next > step && !validate(step)) {
      // 첫 오류 필드로 포커스
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function submit() {
    if (!draftId || submitting) return;
    for (const s of [0, 1, 2]) {
      if (!validate(s)) {
        setStep(s);
        return;
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    // draftId 를 Idempotency-Key 로 사용 → 재시도해도 bot 이 중복 생성되지 않는다.
    const res = await actions.createBot(values, draftId);
    if (res.ok) {
      await actions.discardDraft(draftId);
      writeDraftId(null);
      toast(t("wizard.created"));
      router.push(`${href(`bots/${res.data.id}`)}?tab=connection`);
      return;
    }
    setSubmitting(false);
    if (res.fieldErrors) setErrors(res.fieldErrors);
    setSubmitError(res.error === "limit" ? t("bots.limitReached", { max: snapshot.limits.maxBots }) : t(`errors.${res.error}`));
  }

  function startOver() {
    if (draftId) void actions.discardDraft(draftId);
    const fresh = crypto.randomUUID();
    writeDraftId(fresh);
    setDraftId(fresh);
    setValues(defaultBotInput(locale));
    setStep(0);
    setErrors({});
    setRestored(false);
  }

  const steps = STEP_KEYS.map((k) => ({ key: k, label: t(`wizard.steps.${k}`) }));
  const model = snapshot.models.find((m) => m.id === values.modelId);

  return (
    <div className="mx-auto w-full max-w-[880px]">
      <PageHeader title={t("wizard.title")} description={t("wizard.subtitle")} />
      <GlassCard className="flex flex-col gap-6 p-5 md:p-7">
        <ConnectionStepper steps={steps} current={step} label={t("wizard.progress")} />
        {restored && (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-selected px-3 py-2 text-label text-muted">
            <span className="flex items-center gap-2">
              <Info className="size-4 text-primary" aria-hidden />
              {t("wizard.restored")}
            </span>
            <button type="button" onClick={startOver} className="font-semibold text-primary underline-offset-2 hover:underline">
              {t("wizard.startOver")}
            </button>
          </p>
        )}

        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-section font-semibold outline-none">
            {t(`wizard.steps.${STEP_KEYS[step]}`)}
          </h2>
          <p className="mt-1 text-body text-muted">{t(`wizard.stepDesc.${STEP_KEYS[step]}`)}</p>
        </div>

        {step === 0 && <BasicFields values={values} onChange={onChange} errors={errors} />}
        {step === 1 && <RolesFields values={values} onChange={onChange} errors={errors} />}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <ResponseFields values={values} onChange={onChange} errors={errors} />
            <TestChat botId={null} botName={values.name} />
          </div>
        )}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                [t("wizard.basic.name"), values.name],
                [t("bot.roles"), values.roles.map((r) => t(`roles.${r}.title`)).join(", ")],
                [t("wizard.response.trigger"), values.trigger],
                [t("wizard.response.model"), model?.label ?? "—"],
                [t("bot.tone"), `${t(`tone.${values.tone}`)} · ${t(`length.${values.length}`)}`],
                [t("wizard.response.dailyLimit"), t("wizard.review.perDay", { count: values.dailyLimit })],
              ].map(([k, v]) => (
                <div key={k} className="glass-card !rounded-[14px] p-4">
                  <dt className="text-caption text-muted">{k}</dt>
                  <dd className="mt-1 font-semibold [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="rounded-[14px] border border-glass-border bg-input p-4 text-label leading-6">
              <p className="mb-1 font-semibold">{t("wizard.review.guideTitle")}</p>
              <ul className="list-disc pl-5 text-muted">
                <li>{t("wizard.review.guide1")}</li>
                <li>{t("wizard.review.guide2")}</li>
                <li>{t("wizard.review.guide3")}</li>
              </ul>
            </div>
          </div>
        )}

        {submitError && <ErrorBanner title={submitError} />}

        <div className="flex flex-col-reverse gap-2 border-t border-glass-border pt-5 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || submitting}>
            <ArrowLeft aria-hidden />
            {t("common.back")}
          </Button>
          {step < 3 ? (
            <Button onClick={() => go(step + 1)}>
              {t("common.next")}
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button onClick={submit} loading={submitting}>
              {t("wizard.submit")}
            </Button>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

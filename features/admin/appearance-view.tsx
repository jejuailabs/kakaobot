"use client";

import { Eye, ImagePlus, Monitor, Moon, RotateCcw, Smartphone, Sparkles, Sun, Trash2, Upload } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { DemoBadge, ErrorBanner, GlassCard, StatusPill } from "@/components/glass/glass-card";
import { ScaledFrame } from "@/components/glass/scaled-frame";
import { Button } from "@/components/ui/button";
import { Field, GlassInput, GlassSelect } from "@/components/ui/field";
import { Modal, Switch, Tooltip } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/features/console/console-frame";
import { HeroConsole } from "@/features/landing/hero-console";
import { cn } from "@/lib/shared/cn";
import type { DemoAsset } from "@/lib/shared/demo-admin";
import { useAdmin, type AppearanceSettings } from "./admin-context";
import { ReasonDialog } from "./reason-dialog";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/** 확장자·MIME 표기를 믿지 않고 파일 앞부분 signature 로 판별한다. 서버(S7)에서 재검증·재인코딩·EXIF 제거. */
async function sniff(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

function Slider({ id, label, min, max, step, value, onChange, format }: { id: string; label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-label">
        <label htmlFor={id} className="font-medium">{label}</label>
        <span className="tabular text-muted">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-[var(--primary)]" />
    </div>
  );
}

function Preview({ asset, theme, device, settings }: { asset: DemoAsset | undefined; theme: "light" | "dark"; device: "desktop" | "mobile"; settings: AppearanceSettings }) {
  const overlay = theme === "dark" ? `rgba(6,26,42,${settings.overlay})` : `rgba(234,245,250,${settings.overlay})`;
  return (
    <div className={cn(theme === "dark" ? "theme-dark" : "theme-light", "relative overflow-hidden rounded-[20px] border border-glass-border text-fg", device === "mobile" ? "mx-auto aspect-[9/16] w-[min(100%,280px)]" : "aspect-[16/10] w-full")}>
      <div
        className="absolute -inset-4"
        style={{
          background: "var(--bg-fallback)",
          backgroundImage: asset ? `url("${asset.url}")` : undefined,
          backgroundSize: "cover",
          backgroundPosition: device === "mobile" ? "40% 50%" : "50% 55%",
          filter: `blur(${settings.blur}px) brightness(${settings.brightness})`,
        }}
        aria-hidden
      />
      <div className="absolute inset-0" style={{ background: overlay }} aria-hidden />
      <div className={cn("absolute", device === "mobile" ? "inset-x-3 top-6" : "inset-x-[6%] top-[8%]")}>
        <ScaledFrame width={760} height={520}>
          <HeroConsole />
        </ScaledFrame>
      </div>
    </div>
  );
}

export function AppearanceView() {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { data, actions, mode } = useAdmin();
  const [theme, setTheme] = React.useState<"light" | "dark">("dark");
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const active = data.assets.find((a) => a.theme === theme && a.state === "active");
  const [selectedId, setSelectedId] = React.useState<string | undefined>(active?.id);
  const selected = data.assets.find((a) => a.id === selectedId && a.theme === theme) ?? active;
  const [settings, setSettings] = React.useState<AppearanceSettings>({ overlay: 0.16, blur: 0, brightness: 1, scope: "all" });
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [rollbackId, setRollbackId] = React.useState<string | null>(null);
  const [autoGen, setAutoGen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const aiConfigured = false; // IMAGE_PROVIDER_API_KEY 미설정 (S7 서버 adapter)

  const list = data.assets.filter((a) => a.theme === theme);
  const groups: { key: DemoAsset["state"]; items: DemoAsset[] }[] = [
    { key: "active", items: list.filter((a) => a.state === "active") },
    { key: "draft", items: list.filter((a) => a.state === "draft") },
    { key: "previous", items: list.filter((a) => a.state === "previous") },
  ];

  async function onFile(file: File | undefined) {
    setUploadError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setUploadError(t("admin.appearance.tooLarge"));
    const kind = await sniff(file);
    if (!kind || !ALLOWED.includes(kind)) return setUploadError(t("admin.appearance.badType"));
    if (actions.uploadFile) {
      // 브라우저에서 긴 변 3000px·JPEG 로 줄여 보낸다(요청 한도). 서버가 다시 검증·재인코딩·EXIF 제거.
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (!bitmap) return setUploadError(t("admin.appearance.badType"));
      if (bitmap.width < 1600) return setUploadError(t("admin.appearance.tooSmall", { min: 1600 }));
      const scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (!blob) return setUploadError(t("admin.appearance.badType"));
      const label = file.name.split(".").slice(0, -1).join(".").slice(0, 40) || file.name.slice(0, 40);
      const err = await actions.uploadFile(blob, theme, label);
      if (err) return setUploadError(err.startsWith("admin.") || err.startsWith("errors.") ? t(err, { min: 1600 }) : t("errors.network"));
      toast(t("admin.appearance.uploaded"));
      return;
    }
    const url = URL.createObjectURL(file);
    const width = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth);
      img.onerror = () => resolve(0);
      img.src = url;
    });
    if (width < 1600) {
      URL.revokeObjectURL(url);
      return setUploadError(t("admin.appearance.tooSmall", { min: 1600 }));
    }
    const asset: DemoAsset = { id: `upload-${crypto.randomUUID().slice(0, 6)}`, source: "upload", label: file.name.slice(0, 40), theme, state: "draft", url, createdAt: new Date().toISOString(), sizeKb: Math.round(file.size / 1024), width };
    actions.addUpload(asset);
    setSelectedId(asset.id);
    toast(t("admin.appearance.uploaded"));
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <PageHeader
        title={t("nav.appearance")}
        description={t("admin.appearance.subtitle")}
        actions={
          <div role="radiogroup" aria-label={t("settings.theme")} className="flex gap-1 rounded-full border border-glass-border bg-input p-1">
            {(["dark", "light"] as const).map((th) => (
              <button
                key={th}
                role="radio"
                aria-checked={theme === th}
                onClick={() => {
                  setTheme(th);
                  setSelectedId(undefined);
                }}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-caption font-semibold text-muted", theme === th && "bg-primary text-primary-fg")}
              >
                {th === "dark" ? <Moon className="size-3.5" aria-hidden /> : <Sun className="size-3.5" aria-hidden />}
                {t(`theme.${th}`)}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* 에셋 목록 */}
        <GlassCard className="flex flex-col gap-4 p-4">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden />
            {t("admin.appearance.upload")}
          </Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          <p className="text-caption text-muted">{t("admin.appearance.uploadRules")}</p>
          {uploadError && <p role="alert" className="text-caption font-medium text-danger">{uploadError}</p>}
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.key}>
                <p className="mb-2 text-caption font-semibold text-muted">{t(`admin.appearance.group.${g.key}`)}</p>
                <ul className="flex flex-col gap-2">
                  {g.items.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        aria-pressed={selected?.id === a.id}
                        className={cn("glass-card flex w-full items-center gap-3 !rounded-[14px] p-2 text-left", selected?.id === a.id && "glass-selected")}
                      >
                        <span className="size-12 shrink-0 rounded-[10px] bg-cover bg-center" style={{ backgroundImage: `url("${a.url}")` }} aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-label font-medium">{a.label}</span>
                          <span className="block text-caption text-muted">{a.width}px · {a.sizeKb}KB</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </GlassCard>

        {/* 미리보기 */}
        <GlassCard className="flex min-w-0 flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-semibold">
              {t("admin.appearance.preview")}
              {selected && <StatusPill tone={selected.state === "active" ? "success" : "info"}>{t(`admin.appearance.group.${selected.state}`)}</StatusPill>}
            </p>
            <div role="radiogroup" aria-label={t("admin.appearance.device")} className="flex gap-1 rounded-full border border-glass-border bg-input p-1">
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} role="radio" aria-checked={device === d} aria-label={t(`admin.appearance.${d}`)} onClick={() => setDevice(d)} className={cn("inline-flex size-8 items-center justify-center rounded-full text-muted", device === d && "bg-primary text-primary-fg")}>
                  {d === "desktop" ? <Monitor className="size-4" aria-hidden /> : <Smartphone className="size-4" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
          <Preview asset={selected} theme={theme} device={device} settings={settings} />
          <p className="text-caption text-muted">{t("admin.appearance.previewNote")}</p>
          <div>
            <p className="mb-2 font-semibold">{t("admin.appearance.history")}</p>
            <ul className="flex flex-col divide-y divide-[var(--glass-border)]">
              {list.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="text-label">
                    {a.label} · <span className="text-muted">{format.dateTime(new Date(a.createdAt), { dateStyle: "medium" })}</span>
                  </span>
                  <span className="flex gap-1">
                    {a.state === "previous" && (
                      <Button size="sm" variant="ghost" onClick={() => setRollbackId(a.id)}>
                        <RotateCcw aria-hidden />
                        {t("admin.appearance.restore")}
                      </Button>
                    )}
                    {actions.deleteAsset && a.state !== "active" ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("common.delete")}
                        onClick={async () => {
                          const ok = await actions.deleteAsset?.(a.id);
                          toast(ok ? t("admin.appearance.deleted") : t("admin.appearance.inUse"), ok ? "success" : "error");
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : (
                      <Tooltip content={a.state === "active" ? t("admin.appearance.inUse") : t("admin.appearance.deleteLater")}>
                        <span>
                          <Button size="icon" variant="ghost" disabled aria-label={t("common.delete")}>
                            <Trash2 aria-hidden />
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>

        {/* 설정 */}
        <div className="flex flex-col gap-4">
          <GlassCard className="flex flex-col gap-4 p-4">
            <p className="font-semibold">{t("admin.appearance.settings")}</p>
            <Field id="ap-scope" label={t("admin.appearance.scope")}>
              {(p) => (
                <GlassSelect {...p} value={settings.scope} onChange={(e) => setSettings((s) => ({ ...s, scope: e.target.value as AppearanceSettings["scope"] }))}>
                  {(["all", "dashboard", "landing"] as const).map((s) => (
                    <option key={s} value={s}>{t(`admin.appearance.scopes.${s}`)}</option>
                  ))}
                </GlassSelect>
              )}
            </Field>
            <Slider id="ap-overlay" label={t("admin.appearance.overlay")} min={0} max={0.6} step={0.02} value={settings.overlay} onChange={(v) => setSettings((s) => ({ ...s, overlay: v }))} format={(v) => v.toFixed(2)} />
            <Slider id="ap-blur" label={t("admin.appearance.blur")} min={0} max={8} step={1} value={settings.blur} onChange={(v) => setSettings((s) => ({ ...s, blur: v }))} format={(v) => `${v}px`} />
            <Slider id="ap-bright" label={t("admin.appearance.brightness")} min={0.6} max={1.2} step={0.02} value={settings.brightness} onChange={(v) => setSettings((s) => ({ ...s, brightness: v }))} format={(v) => v.toFixed(2)} />
            <p className="text-caption text-muted">{t("admin.appearance.panelNote")}</p>
          </GlassCard>

          <GlassCard className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <Sparkles className="size-4 text-accent" aria-hidden />
                {t("admin.appearance.aiTitle")}
              </p>
              <StatusPill tone="neutral">{t("common.notConfigured")}</StatusPill>
            </div>
            <p className="text-caption text-muted">{t("admin.appearance.aiUnconfigured")}</p>
            <div className="flex flex-wrap gap-1.5" aria-disabled>
              {["mountain", "lake", "sea", "forest", "abstract"].map((k) => (
                <span key={k} className="rounded-full border border-glass-border px-2.5 py-1 text-caption text-muted opacity-60">{t(`admin.appearance.scenes.${k}`)}</span>
              ))}
            </div>
            <Button variant="secondary" disabled={!aiConfigured}>
              <ImagePlus aria-hidden />
              {t("admin.appearance.generate")}
            </Button>
          </GlassCard>

          <GlassCard className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="ap-auto" className="font-semibold">{t("admin.appearance.autoTitle")}</label>
              <Switch id="ap-auto" checked={autoGen} onCheckedChange={setAutoGen} disabled={!aiConfigured} />
            </div>
            <fieldset disabled={!aiConfigured || !autoGen} className="grid grid-cols-2 gap-3 disabled:opacity-60">
              <Field id="ap-cycle" label={t("admin.appearance.cycle")}>
                {(p) => (
                  <GlassSelect {...p} defaultValue="weekly">
                    <option value="weekly">{t("admin.appearance.weekly")}</option>
                    <option value="monthly">{t("admin.appearance.monthly")}</option>
                  </GlassSelect>
                )}
              </Field>
              <Field id="ap-time" label={t("admin.appearance.time")}>
                {(p) => <GlassInput {...p} type="time" defaultValue="09:00" />}
              </Field>
              <Field id="ap-max" label={t("admin.appearance.maxPerMonth")}>
                {(p) => <GlassInput {...p} type="number" min={1} max={4} defaultValue={4} />}
              </Field>
              <Field id="ap-budget" label={t("admin.appearance.budget")}>
                {(p) => <GlassInput {...p} type="number" min={0} defaultValue={10} />}
              </Field>
              <label className="col-span-2 flex items-center justify-between gap-2 text-label">
                {t("admin.appearance.autoApply")}
                <Switch disabled />
              </label>
            </fieldset>
            <p className="text-caption text-muted">{t("admin.appearance.autoNote")}</p>
          </GlassCard>
        </div>
      </div>

      {/* sticky footer: 미리보기 / 적용하기 */}
      <div className="sticky bottom-4 z-20">
        <div className="glass-solid flex flex-col gap-3 rounded-[18px] p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-label text-muted">
            {mode === "demo" && <DemoBadge label={t("common.demo")} />}
            {selected?.state === "active" ? t("admin.appearance.isActive") : t("admin.appearance.notApplied")}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
              <Eye aria-hidden />
              {t("admin.appearance.previewBtn")}
            </Button>
            <Button onClick={() => setPublishOpen(true)} disabled={!selected}>
              {t("admin.appearance.apply")}
            </Button>
          </div>
        </div>
      </div>

      <Modal open={previewOpen} onOpenChange={setPreviewOpen} title={t("admin.appearance.preview")} closeLabel={t("common.close")} wide>
        <div className="grid gap-4 md:grid-cols-[1fr_200px] md:items-start">
          <Preview asset={selected} theme={theme} device="desktop" settings={settings} />
          <Preview asset={selected} theme={theme} device="mobile" settings={settings} />
        </div>
      </Modal>

      <ReasonDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={t("admin.appearance.applyConfirm")}
        confirmLabel={t("admin.appearance.apply")}
        onConfirm={async (reason) => {
          if (!selected) return;
          await actions.publishAsset(selected.id, theme, reason, settings);
          toast(t("admin.appearance.applied"));
        }}
      >
        <dl className="grid grid-cols-3 gap-2 text-label">
          {[
            [t("admin.appearance.scope"), t(`admin.appearance.scopes.${settings.scope}`)],
            [t("settings.theme"), t(`theme.${theme}`)],
            [t("admin.appearance.asset"), selected?.label ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="glass-card !rounded-[12px] p-3">
              <dt className="text-caption text-muted">{k}</dt>
              <dd className="font-semibold [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        {mode === "demo" && <ErrorBanner tone="info" title={t("admin.appearance.demoApplyNote")} />}
      </ReasonDialog>

      <ReasonDialog
        open={!!rollbackId}
        onOpenChange={(o) => !o && setRollbackId(null)}
        title={t("admin.appearance.restore")}
        confirmLabel={t("admin.appearance.restore")}
        onConfirm={async (reason) => {
          if (rollbackId) await actions.rollback(rollbackId, reason);
          toast(t("admin.appearance.applied"));
        }}
      />
    </div>
  );
}

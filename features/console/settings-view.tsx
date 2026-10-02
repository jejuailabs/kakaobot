"use client";

import { Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import * as React from "react";
import { CardTitle, GlassCard } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/shared/cn";
import { useConsole } from "./console-context";
import { PageHeader } from "./console-frame";

function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T | undefined;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-label font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "glass-card flex h-12 cursor-pointer items-center justify-center gap-2 !rounded-[12px] px-3 text-body font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
              value === o.value && "glass-selected text-primary",
            )}
          >
            <input type="radio" className="sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.icon}
            <span lang={o.value.length === 2 ? o.value : undefined}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsView() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { mode } = useConsole();
  const [mounted, setMounted] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 테마 값은 클라이언트에서만 확정된다
  React.useEffect(() => setMounted(true), []);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <GlassCard className="flex flex-col gap-6">
        <CardTitle className="mb-0">{t("settings.appearance")}</CardTitle>
        <Segmented
          legend={t("settings.language")}
          value={locale}
          options={locales.map((l) => ({ value: l, label: t(`locale.${l}`) }))}
          onChange={(l) => {
            const qs = window.location.search.replace(/^\?/, "");
            router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: l });
          }}
        />
        <Segmented
          legend={t("settings.theme")}
          value={mounted ? (theme as "light" | "dark" | "system") : undefined}
          options={[
            { value: "system", label: t("theme.system"), icon: <Monitor className="size-4" aria-hidden /> },
            { value: "light", label: t("theme.light"), icon: <Sun className="size-4" aria-hidden /> },
            { value: "dark", label: t("theme.dark"), icon: <Moon className="size-4" aria-hidden /> },
          ]}
          onChange={setTheme}
        />
        <p className="text-caption text-muted">{t("settings.localeNote")}</p>
      </GlassCard>

      <GlassCard>
        <CardTitle>{t("settings.data")}</CardTitle>
        <p className="text-body text-muted">{t("settings.dataDesc")}</p>
        <div className="mt-4 flex flex-col gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{t("settings.deleteAccount")}</p>
            <p className="text-label text-muted">{mode === "demo" ? t("settings.deleteDemo") : t("settings.deleteDesc")}</p>
          </div>
          <Button variant="danger" disabled className="shrink-0" aria-describedby="delete-unavailable">
            <Trash2 aria-hidden />
            {t("settings.deleteAccount")}
          </Button>
        </div>
        <p id="delete-unavailable" className="mt-2 text-caption text-muted">
          {t("settings.deleteUnavailable")}
        </p>
      </GlassCard>
    </div>
  );
}

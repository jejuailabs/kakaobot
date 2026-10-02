"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/primitives";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/shared/cn";

/** 언어를 바꿔도 현재 route·query 를 보존한다. draft 는 서버/세션 저장소에 있으므로 유지된다. */
export function LocaleMenu({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useTranslations("locale");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const qs = window.location.search.replace(/^\?/, "");
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: next as Locale, scroll: false });
    });
  }

  return (
    <Menu>
      <MenuTrigger
        aria-label={t("label")}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-full border border-glass-border bg-input px-3 text-label font-medium text-fg disabled:opacity-60",
          className,
        )}
        disabled={pending}
      >
        <Globe className="size-4 text-muted" aria-hidden />
        {!compact && <span>{t(locale)}</span>}
        <ChevronDown className="size-3.5 text-muted" aria-hidden />
      </MenuTrigger>
      <MenuContent>
        <MenuRadioGroup value={locale} onValueChange={change}>
          {locales.map((l) => (
            <MenuRadioItem key={l} value={l} lang={l}>
              {t(l)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

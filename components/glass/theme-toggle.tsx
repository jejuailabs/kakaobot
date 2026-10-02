"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import * as React from "react";
import { cn } from "@/lib/shared/cn";

function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** 토글 시 light/dark 를 명시 저장한다. system 재선택은 설정 화면에서. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={t("toggle")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-10 w-[68px] shrink-0 items-center rounded-full border border-glass-border bg-input p-1 transition-colors",
        className,
      )}
    >
      <span className="flex w-full items-center justify-between px-1.5 text-muted" aria-hidden>
        <Sun className="size-4" />
        <Moon className="size-4" />
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute top-1 left-1 inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-fg shadow transition-transform duration-200",
          isDark && "translate-x-[28px]",
          !mounted && "opacity-0",
        )}
      >
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </span>
    </button>
  );
}

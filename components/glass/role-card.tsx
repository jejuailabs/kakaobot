"use client";

import { Check, FileQuestion, Megaphone, MessageCircleQuestion, Search, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RoleId } from "@/lib/shared/domain";
import { cn } from "@/lib/shared/cn";

const icons: Record<RoleId, React.ComponentType<{ className?: string }>> = {
  qa: MessageCircleQuestion,
  faq: FileQuestion,
  notice: Megaphone,
  search: Search,
  custom: Wand2,
};

/** 다중 선택 카드. disabled 는 클릭되지 않으며 사유를 함께 보여준다. */
export function RoleCard({
  role,
  selected,
  disabled,
  disabledReason,
  onToggle,
}: {
  role: RoleId;
  selected: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onToggle: () => void;
}) {
  const t = useTranslations("roles");
  const Icon = icons[role];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "glass-card relative flex h-full flex-col items-start gap-3 p-4 text-left",
        !disabled && "glass-hover",
        selected && "glass-selected",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="inline-flex size-10 items-center justify-center rounded-[12px] bg-selected text-primary" aria-hidden>
          <Icon className="size-5" />
        </span>
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full border border-glass-border",
            selected && "border-primary bg-primary text-primary-fg",
          )}
          aria-hidden
        >
          {selected && <Check className="size-3.5" />}
        </span>
      </span>
      <span>
        <span className="block font-semibold">{t(`${role}.title`)}</span>
        <span className="mt-1 block text-label text-muted">{t(`${role}.desc`)}</span>
        {disabled && disabledReason && <span className="mt-2 block text-caption font-medium text-warning">{disabledReason}</span>}
      </span>
    </button>
  );
}

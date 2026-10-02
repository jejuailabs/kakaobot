import { Check } from "lucide-react";
import { cn } from "@/lib/shared/cn";

export type Step = { key: string; label: string };

/** 단계 표시. 현재 단계는 aria-current="step". */
export function ConnectionStepper({ steps, current, className, label }: { steps: Step[]; current: number; className?: string; label: string }) {
  return (
    <ol aria-label={label} className={cn("flex w-full items-center gap-2", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} aria-current={active ? "step" : undefined} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-bold tabular",
                done && "border-primary bg-primary text-primary-fg",
                active && "border-primary bg-selected text-primary",
                !done && !active && "border-glass-border text-muted",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn("hidden truncate text-label font-medium sm:inline", active ? "text-fg" : "text-muted")}>{s.label}</span>
            {active && <span className="truncate text-label font-medium sm:hidden">{s.label}</span>}
            {i < steps.length - 1 && <span className={cn("h-px min-w-3 flex-1", done ? "bg-primary" : "bg-glass-border")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

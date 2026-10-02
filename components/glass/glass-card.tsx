import { AlertTriangle, CheckCircle2, Clock, CircleDashed, PauseCircle, RefreshCw, WifiOff, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/shared/cn";

export function GlassCard({
  className,
  as: Comp = "section",
  interactive,
  selected,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" | "li"; interactive?: boolean; selected?: boolean }) {
  return (
    <Comp
      className={cn("glass-card p-5", interactive && "glass-hover", selected && "glass-selected", className)}
      {...props}
    />
  );
}

export function CardTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="text-section font-semibold">{children}</h2>
      {action}
    </div>
  );
}

/* ───────── StatCard: 1:1.1 비율, 강조색은 아이콘 작은 면적 ───────── */
export function StatCard({
  label,
  value,
  icon,
  delta,
  hint,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  delta?: { text: string; positive: boolean } | null;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <GlassCard as="div" className="flex min-h-[132px] flex-col justify-between gap-3 p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-label text-muted">{label}</span>
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-selected text-primary [&_svg]:size-4" aria-hidden>
          {icon}
        </span>
      </div>
      {loading ? (
        <div className="skeleton h-8 w-20" />
      ) : (
        <div>
          <p className="text-kpi tabular font-semibold">{value}</p>
          {delta ? (
            <p className={cn("mt-0.5 text-caption tabular font-medium", delta.positive ? "text-success" : "text-danger")}>{delta.text}</p>
          ) : hint ? (
            <p className="mt-0.5 text-caption text-muted">{hint}</p>
          ) : null}
        </div>
      )}
    </GlassCard>
  );
}

/* ───────── StatusPill: 색 + 아이콘 + 텍스트 ───────── */
export type PillTone = "success" | "warning" | "danger" | "neutral" | "info";

const pillIcon: Record<PillTone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  neutral: PauseCircle,
  info: CircleDashed,
};

export function StatusPill({ tone, children, className }: { tone: PillTone; children: React.ReactNode; className?: string }) {
  const Icon = pillIcon[tone];
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-caption font-semibold",
        tone === "success" && "border-[color-mix(in_srgb,var(--success)_45%,transparent)] bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success",
        tone === "warning" && "border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-warning",
        tone === "danger" && "border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger",
        tone === "neutral" && "border-glass-border bg-[color-mix(in_srgb,var(--text)_8%,transparent)] text-muted",
        tone === "info" && "border-[color-mix(in_srgb,var(--primary)_45%,transparent)] bg-selected text-primary",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

export function DemoBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-2 text-[11px] font-bold tracking-wide text-accent",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <span className="inline-flex size-12 items-center justify-center rounded-[16px] bg-selected text-primary [&_svg]:size-6" aria-hidden>
        {icon}
      </span>
      <div className="max-w-sm">
        <p className="text-section font-semibold">{title}</p>
        {description && <p className="mt-1 text-body text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden />;
}

export function ErrorBanner({
  tone = "danger",
  title,
  description,
  action,
  className,
  icon,
}: {
  tone?: "danger" | "warning" | "info";
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  icon?: "offline" | "alert" | "retry";
}) {
  const Icon = icon === "offline" ? WifiOff : icon === "retry" ? RefreshCw : AlertTriangle;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "glass-card flex flex-col gap-3 border-l-4 p-4 sm:flex-row sm:items-center sm:justify-between",
        tone === "danger" && "border-l-danger",
        tone === "warning" && "border-l-warning",
        tone === "info" && "border-l-primary",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-5 shrink-0",
            tone === "danger" && "text-danger",
            tone === "warning" && "text-warning",
            tone === "info" && "text-primary",
          )}
          aria-hidden
        />
        <div>
          <p className="font-semibold">{title}</p>
          {description && <div className="text-body text-muted">{description}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

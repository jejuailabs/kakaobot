import * as React from "react";
import { cn } from "@/lib/shared/cn";

const control =
  "w-full rounded-[12px] border border-input-border bg-input px-3.5 hover:border-primary text-[14px] text-fg placeholder:text-muted/80 outline-none transition-shadow focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

export function GlassInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function GlassTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-36 py-3 leading-[22px]", className)} {...props} />;
}

export function GlassSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "var(--select-chevron)" }} {...props}>
      {children}
    </select>
  );
}

type FieldProps = {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  counter?: { value: number; max: number };
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
  className?: string;
};

/** label 은 placeholder 와 분리하고, 오류·힌트를 aria-describedby 로 연결한다. */
export function Field({ id, label, hint, error, counter, children, className }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label font-medium text-fg">
          {label}
        </label>
        {counter && (
          <span className={cn("text-caption tabular text-muted", counter.value > counter.max && "text-danger")}>
            {counter.value.toLocaleString()}/{counter.max.toLocaleString()}
          </span>
        )}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-caption font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

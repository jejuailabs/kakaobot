import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/shared/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-[14px] font-semibold transition-[background-color,box-shadow,transform,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_28%,transparent)] hover:shadow-[0_0_16px_color-mix(in_srgb,var(--primary)_20%,transparent)] hover:brightness-105",
        secondary:
          "glass-card text-fg hover:bg-[color-mix(in_srgb,var(--card-fill)_70%,var(--primary)_10%)]",
        ghost: "text-fg hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)]",
        danger: "bg-danger text-white dark:text-[#3a0612] hover:brightness-105",
        kakao: "bg-kakao text-kakao-fg hover:brightness-95",
        outline:
          "border border-glass-border bg-transparent text-fg hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]",
      },
      size: {
        md: "h-11 px-4",
        lg: "h-12 px-6 text-[15px]",
        sm: "h-9 px-3 text-[13px]",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

/** loading 동안 disabled + aria-busy 로 중복 submit 을 막는다. */
export function Button({ className, variant, size, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), size === "icon" && "relative after:absolute after:-inset-0.5", className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}

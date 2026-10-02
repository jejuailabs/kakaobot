"use client";

import { X } from "lucide-react";
import { Dialog, DropdownMenu, Switch as RSwitch, Tabs as RTabs, Tooltip as RTooltip } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/shared/cn";

/* ───────── Switch ───────── */
export function Switch({ className, ...props }: React.ComponentProps<typeof RSwitch.Root>) {
  return (
    <RSwitch.Root
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-glass-border bg-[color-mix(in_srgb,var(--text)_18%,transparent)] transition-colors data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50 after:absolute after:-inset-2.5",
        className,
      )}
      {...props}
    >
      <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px] dark:data-[state=checked]:bg-primary-fg" />
    </RSwitch.Root>
  );
}

/* ───────── Tabs ───────── */
export const Tabs = RTabs.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof RTabs.List>) {
  return (
    <RTabs.List
      className={cn("glass-card flex w-full gap-1 overflow-x-auto p-1 [scrollbar-width:none]", className)}
      {...props}
    />
  );
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        "h-10 shrink-0 rounded-[12px] px-4 text-label font-medium text-muted transition-colors hover:text-fg data-[state=active]:bg-primary data-[state=active]:text-primary-fg",
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = RTabs.Content;

/* ───────── Tooltip (불투명 surface) ───────── */
export const TooltipProvider = RTooltip.Provider;
export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          sideOffset={6}
          className="glass-solid z-50 max-w-72 rounded-[10px] px-3 py-2 text-caption text-fg shadow-lg"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/* ───────── Modal: desktop 640px, mobile bottom sheet + sticky footer ───────── */
type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel: string;
  wide?: boolean;
};

export function Modal({ open, onOpenChange, title, description, children, footer, closeLabel, wide }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-50 bg-[rgba(3,20,38,0.45)]" />
        <Dialog.Content
          className={cn(
            "glass-solid animate-sheet-up fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[24px] shadow-2xl outline-none",
            "md:animate-fade-in md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[85dvh] md:w-[min(640px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[24px]",
            wide && "md:w-[min(880px,calc(100vw-48px))]",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-glass-border px-5 pb-4 pt-5 md:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-section font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-body text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] text-muted hover:text-fg"
              aria-label={closeLabel}
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>}
          {footer && (
            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-glass-border px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end md:px-6">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ───────── Side sheet (모바일 sidebar, drawer) ───────── */
type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  side?: "left" | "right";
  children: React.ReactNode;
  closeLabel: string;
  widthClass?: string;
  hideTitle?: boolean;
};

export function Sheet({ open, onOpenChange, title, side = "left", children, closeLabel, widthClass, hideTitle }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-50 bg-[rgba(3,20,38,0.45)]" />
        <Dialog.Content
          className={cn(
            "glass-solid fixed inset-y-0 z-50 flex w-[min(320px,86vw)] flex-col shadow-2xl outline-none",
            side === "left" ? "animate-sheet-in left-0 rounded-r-[24px]" : "right-0 rounded-l-[24px] animate-fade-in",
            widthClass,
          )}
        >
          <div className={cn("flex items-center justify-between gap-3 px-5 pt-5", hideTitle && "absolute right-2 top-2 p-0")}>
            <Dialog.Title className={cn("text-section font-semibold", hideTitle && "sr-only")}>{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
            <Dialog.Close className="inline-flex size-10 items-center justify-center rounded-[12px] text-muted hover:text-fg" aria-label={closeLabel}>
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ───────── Dropdown ───────── */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export function MenuContent({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={8}
        align="end"
        className={cn("glass-solid z-50 min-w-44 rounded-[14px] p-1.5 shadow-xl", className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}
export function MenuItem({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex h-10 cursor-pointer items-center gap-2 rounded-[10px] px-3 text-body text-fg outline-none data-[highlighted]:bg-selected data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
export const MenuRadioGroup = DropdownMenu.RadioGroup;
export function MenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem
      className={cn(
        "flex h-10 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 text-body text-fg outline-none data-[highlighted]:bg-selected data-[state=checked]:font-semibold",
        className,
      )}
      {...props}
    >
      {children}
      <DropdownMenu.ItemIndicator>
        <span className="size-2 rounded-full bg-primary" aria-hidden />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}
export function MenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-3 py-1.5 text-caption text-muted", className)} {...props} />;
}
export const MenuSeparator = (props: React.ComponentProps<typeof DropdownMenu.Separator>) => (
  <DropdownMenu.Separator className="my-1 h-px bg-glass-border" {...props} />
);

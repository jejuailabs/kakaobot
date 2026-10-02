"use client";

import {
  Activity,
  BarChart3,
  Bot,
  ClipboardList,
  DoorOpen,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessagesSquare,
  RadioTower,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Sheet } from "@/components/ui/primitives";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/shared/cn";
import { DemoBadge } from "./glass-card";
import { LocaleMenu } from "./locale-menu";
import { ThemeToggle } from "./theme-toggle";

export type NavItem = { key: string; href: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };

export function userNav(href: (p: string) => string): NavItem[] {
  return [
    { key: "dashboard", href: href("dashboard"), icon: LayoutDashboard, exact: true },
    { key: "bots", href: href("bots"), icon: Bot },
    { key: "rooms", href: href("rooms"), icon: MessagesSquare },
    { key: "prompts", href: href("prompts"), icon: FileText },
    { key: "analytics", href: href("analytics"), icon: BarChart3 },
    { key: "settings", href: href("settings"), icon: Settings },
  ];
}

export function adminNav(href: (p: string) => string): NavItem[] {
  return [
    { key: "adminOverview", href: href("admin"), icon: Activity, exact: true },
    { key: "joinRequests", href: href("admin/join-requests"), icon: DoorOpen },
    { key: "members", href: href("admin/members"), icon: Users },
    { key: "conversations", href: href("admin/conversations"), icon: ScrollText },
    { key: "audit", href: href("admin/audit"), icon: ClipboardList },
    { key: "appearance", href: href("admin/appearance"), icon: ImageIcon },
    { key: "jobs", href: href("admin/jobs"), icon: Workflow },
    { key: "gateways", href: href("admin/gateways"), icon: RadioTower },
  ];
}

function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 whitespace-nowrap font-semibold", className)}>
      <span
        className="inline-flex size-8 items-center justify-center rounded-[10px] bg-kakao text-kakao-fg shadow-[inset_0_-2px_0_rgba(0,0,0,0.08)]"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor">
          <path d="M12 4C7.03 4 3 7.13 3 11c0 2.4 1.56 4.52 3.94 5.78L6 20l3.7-2.32c.74.13 1.51.2 2.3.2 4.97 0 9-3.13 9-7s-4.03-6.88-9-6.88Z" />
        </svg>
      </span>
      <span className="text-[17px] tracking-tight">Katcha</span>
    </span>
  );
}

export { BrandMark };

function NavList({ items, onNavigate, label }: { items: NavItem[]; onNavigate?: () => void; label: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[12px] px-3 text-body font-medium text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-fg",
                  active && "glass-card !rounded-[12px] text-fg shadow-none [&>svg]:text-primary",
                )}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden />
                <span className="truncate">{t(item.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function GlassSidebar({
  items,
  secondary,
  onNavigate,
  className,
  isAdmin,
}: {
  items: NavItem[];
  secondary?: { label: string; items: NavItem[] };
  onNavigate?: () => void;
  className?: string;
  isAdmin?: boolean;
}) {
  const t = useTranslations("nav");
  return (
    <div className={cn("flex h-full flex-col gap-6", className)}>
      <div className="flex flex-col items-start gap-2 px-2">
        <BrandMark className="whitespace-nowrap" />
        {isAdmin && (
          <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-selected px-2 text-[11px] font-bold text-primary">
            <ShieldCheck className="size-3" aria-hidden />
            {t("operatorBadge")}
          </span>
        )}
      </div>
      <NavList items={items} onNavigate={onNavigate} label={t("primary")} />
      {secondary && secondary.items.length > 0 && (
        <div>
          <p className="mb-2 px-3 text-caption font-semibold uppercase tracking-wide text-muted">{secondary.label}</p>
          <NavList items={secondary.items} onNavigate={onNavigate} label={secondary.label} />
        </div>
      )}
    </div>
  );
}

export function GlassHeader({
  onOpenMenu,
  demo,
  user,
  accountItems,
  title,
}: {
  onOpenMenu: () => void;
  demo?: boolean;
  user: { displayName: string; email: string };
  accountItems: React.ReactNode;
  title?: React.ReactNode;
}) {
  const t = useTranslations();
  return (
    <header className="flex min-h-[56px] items-center gap-2 md:min-h-[64px]">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label={t("common.openMenu")}>
        <MenuIcon className="!size-5" aria-hidden />
      </Button>
      <div className="min-w-0 flex-1">{title}</div>
      <div className="flex items-center gap-2">
        {demo && <DemoBadge label={t("common.demo")} className="hidden sm:inline-flex" />}
        <LocaleMenu className="hidden sm:inline-flex" />
        <LocaleMenu className="sm:hidden" compact />
        <ThemeToggle />
        <Menu>
          <MenuTrigger
            className="inline-flex size-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-label font-bold text-primary-fg"
            aria-label={t("header.account")}
          >
            {user.displayName.slice(0, 1).toUpperCase()}
          </MenuTrigger>
          <MenuContent className="min-w-56">
            <MenuLabel>
              <span className="block truncate text-body font-semibold text-fg">{user.displayName}</span>
              <span className="block truncate">{user.email}</span>
            </MenuLabel>
            <MenuSeparator />
            {accountItems}
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}

/** 배경 → main glass(panel) → 내부 card 의 3 층. 바깥 margin 24, sidebar 216/184. */
export function GlassShell({
  nav,
  secondaryNav,
  isAdmin,
  demo,
  user,
  accountItems,
  banner,
  children,
}: {
  nav: NavItem[];
  secondaryNav?: { label: string; items: NavItem[] };
  isAdmin?: boolean;
  demo?: boolean;
  user: { displayName: string; email: string };
  accountItems: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  return (
    <div className="min-h-dvh md:p-6 lg:p-5 xl:p-6">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-[12px] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
      >
        {t("skipToContent")}
      </a>
      <div className="glass-panel mx-auto flex min-h-dvh w-full max-w-[1392px] rounded-none border-x-0 md:min-h-[calc(100dvh-48px)] md:rounded-[28px] md:border-x">
        <aside className="hidden w-[184px] shrink-0 border-r border-glass-border px-3 py-6 lg:block xl:w-[216px] xl:px-4">
          <div className="sticky top-6">
            <GlassSidebar items={nav} secondary={secondaryNav} isAdmin={isAdmin} />
          </div>
        </aside>
        <Sheet open={open} onOpenChange={setOpen} title={t("menu")} closeLabel={t("closeMenu")} hideTitle>
          <div className="px-4 pb-6 pt-5">
            <GlassSidebar items={nav} secondary={secondaryNav} isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
          </div>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col px-4 pb-8 pt-2 md:px-5 xl:px-6">
          <GlassHeader onOpenMenu={() => setOpen(true)} demo={demo} user={user} accountItems={accountItems} />
          {banner}
          <main id="main" className="min-w-0 flex-1 pt-2" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function AccountMenuLink({ href, children, icon }: { href: string; children: React.ReactNode; icon?: "settings" | "exit" | "admin" | "console" }) {
  const Icon = icon === "exit" ? LogOut : icon === "admin" ? ShieldCheck : icon === "console" ? LayoutDashboard : Settings;
  return (
    <MenuItem asChild>
      <Link href={href}>
        <Icon className="size-4 text-muted" aria-hidden />
        {children}
      </Link>
    </MenuItem>
  );
}

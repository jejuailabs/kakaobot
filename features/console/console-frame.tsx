"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { ErrorBanner } from "@/components/glass/glass-card";
import { AccountMenuLink, adminNav, GlassShell, userNav } from "@/components/glass/shell";
import { MenuItem } from "@/components/ui/primitives";
import { usePathname } from "@/i18n/navigation";
import { useConsole } from "./console-context";
import { useRelativeTime } from "@/components/ui/use-relative-time";

export function ConsoleFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const rel = useRelativeTime();
  const { mode, snapshot, href, actions } = useConsole();
  const pathname = usePathname();
  const isAdmin = pathname === href("admin") || pathname.startsWith(`${href("admin")}/`);
  const demo = mode === "demo";

  const nav = isAdmin ? adminNav(href) : userNav(href);
  const gateway = snapshot.gateway;

  const banner = (
    <div className="flex flex-col gap-3 pb-2">
      {demo && (
        <p className="glass-card flex flex-wrap items-center gap-x-2 gap-y-1 !rounded-[14px] border-l-4 border-l-accent px-4 py-2.5 text-label">
          <strong className="font-semibold text-accent">{t("common.demo")}</strong>
          <span className="text-muted">{t("demo.banner")}</span>
        </p>
      )}
      {!isAdmin && (gateway.health === "offline" || gateway.health === "degraded") && (
        <ErrorBanner
          tone="warning"
          icon="offline"
          title={t("dashboard.gatewayDelayed")}
          description={
            gateway.lastCheckedAt
              ? t("dashboard.lastChecked", { time: rel(gateway.lastCheckedAt) })
              : undefined
          }
        />
      )}
    </div>
  );

  const accountItems = (
    <>
      {isAdmin ? (
        <AccountMenuLink href={href("dashboard")} icon="console">
          {t("nav.backToConsole")}
        </AccountMenuLink>
      ) : (
        <AccountMenuLink href={href("settings")} icon="settings">
          {t("nav.settings")}
        </AccountMenuLink>
      )}
      {demo && !isAdmin && (
        <AccountMenuLink href={href("admin")} icon="admin">
          {t("nav.adminDemo")}
        </AccountMenuLink>
      )}
      {demo && actions.simulate && (
        <MenuItem onSelect={() => actions.simulate?.reset()}>
          <RotateCcw className="size-4 text-muted" aria-hidden />
          {t("demo.reset")}
        </MenuItem>
      )}
      <AccountMenuLink href="/" icon="exit">
        {demo ? t("demo.exit") : t("nav.logout")}
      </AccountMenuLink>
    </>
  );

  return (
    <GlassShell nav={nav} isAdmin={isAdmin} demo={demo} user={snapshot.user} accountItems={accountItems} banner={banner}>
      {children}
    </GlassShell>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-heading font-[650]">{title}</h1>
        {description && <p className="mt-1 text-body text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

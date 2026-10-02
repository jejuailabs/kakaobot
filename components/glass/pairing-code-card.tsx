"use client";

import { Copy, RefreshCw, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared/cn";

function useCountdown(expiresAt: string) {
  const [left, setLeft] = React.useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  React.useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const h = window.setInterval(tick, 1000);
    return () => window.clearInterval(h);
  }, [expiresAt]);
  return left;
}

export function PairingCodeCard({
  code,
  expiresAt,
  onReissue,
  reissuing,
}: {
  code: string;
  expiresAt: string;
  onReissue: () => void;
  reissuing?: boolean;
}) {
  const t = useTranslations("connection");
  const left = useCountdown(expiresAt);
  const [copied, setCopied] = React.useState(false);
  const expired = left <= 0;
  const command = t("command", { code });
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="glass-card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{t("codeTitle")}</p>
        <span className={cn("text-label font-semibold tabular", expired ? "text-danger" : "text-muted")} aria-live="polite">
          {expired ? t("codeExpired") : t("expiresIn", { time: `${mm}:${ss}` })}
        </span>
      </div>
      <div
        className={cn(
          "flex flex-col items-center gap-1 rounded-[16px] border border-dashed border-[color-mix(in_srgb,var(--kakao)_70%,transparent)] bg-[color-mix(in_srgb,var(--kakao)_10%,transparent)] px-4 py-5",
          expired && "opacity-50",
        )}
      >
        <code className="text-[26px] font-bold tracking-[0.12em] tabular md:text-[30px]" aria-label={t("codeAria", { code: code.split("").join(" ") })}>
          {command}
        </code>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={copy} disabled={expired} variant="kakao" className="flex-1">
          <Copy aria-hidden />
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button onClick={onReissue} variant="secondary" loading={reissuing} className="flex-1">
          {!reissuing && <RefreshCw aria-hidden />}
          {t("reissue")}
        </Button>
      </div>
      <p className="flex items-start gap-2 text-caption text-muted">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        {t("codeWarning")}
      </p>
    </div>
  );
}

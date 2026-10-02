"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { ChatPreview } from "@/components/glass/chat-preview";
import { ScaledFrame } from "@/components/glass/scaled-frame";
import { cn } from "@/lib/shared/cn";
import { HeroConsole } from "./hero-console";

function Phone({ className }: { className?: string }) {
  const t = useTranslations("landing.chat");
  return (
    <ChatPreview
      className={className}
      title={t("title")}
      subtitle={t("subtitle")}
      inputPlaceholder={t("input")}
      lines={[
        { from: "user", text: t("q1") },
        { from: "bot", name: "Katcha AI", text: t("a1") },
        { from: "user", text: t("q2") },
        { from: "bot", name: "Katcha AI", text: t("a2") },
      ]}
    />
  );
}

/** ≥1360px: 콘솔 57% + phone 15% 겹침(최대 56px). 그 미만: 탭 전환으로 겹침 제거. */
export function HeroPreview() {
  const t = useTranslations("landing");
  const [tab, setTab] = React.useState<"console" | "chat">("console");

  return (
    <>
      {/* wide: overlap */}
      <div className="relative hidden min-[1360px]:flex min-[1360px]:items-center">
        <div className="w-[79%]">
          <ScaledFrame width={760} height={520}>
            <HeroConsole />
          </ScaledFrame>
        </div>
        <div className="relative z-10 -ml-[56px] w-[21%] translate-y-6">
          <Phone />
        </div>
      </div>

      {/* tablet / mobile: tabs */}
      <div className="min-[1360px]:hidden">
        <div role="tablist" aria-label={t("previewTabs")} className="glass-card mx-auto mb-4 flex w-fit gap-1 !rounded-full p-1">
          {(["console", "chat"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              id={`hero-tab-${k}`}
              aria-selected={tab === k}
              aria-controls={`hero-panel-${k}`}
              onClick={() => setTab(k)}
              className={cn(
                "h-10 rounded-full px-5 text-label font-semibold text-muted",
                tab === k && "bg-primary text-primary-fg",
              )}
            >
              {t(k === "console" ? "tabConsole" : "tabChat")}
            </button>
          ))}
        </div>
        <div id="hero-panel-console" role="tabpanel" aria-labelledby="hero-tab-console" hidden={tab !== "console"}>
          <ScaledFrame width={760} height={520}>
            <HeroConsole />
          </ScaledFrame>
        </div>
        <div id="hero-panel-chat" role="tabpanel" aria-labelledby="hero-tab-chat" hidden={tab !== "chat"}>
          <div className="mx-auto w-[min(260px,72vw)]">
            <Phone />
          </div>
        </div>
      </div>
    </>
  );
}

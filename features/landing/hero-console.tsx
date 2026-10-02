"use client";

import { BarChart3, Bot, FileText, LayoutDashboard, MessagesSquare, Settings, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/glass/shell";
import { cn } from "@/lib/shared/cn";

// 히어로용 정적 콘솔 mock (760×520). 표시 숫자는 DEMO 값이다.
const BARS = [38, 52, 44, 61, 48, 70, 57, 66, 74, 59, 81, 69, 88, 76, 92, 84];
const LINE = [55, 58, 54, 62, 60, 66, 63, 70, 68, 72, 71, 76, 74, 79, 78, 82];

function MiniChart() {
  const w = 404;
  const h = 128;
  const step = w / BARS.length;
  const path = LINE.map((v, i) => `${i === 0 ? "M" : "L"}${(i + 0.5) * step} ${h - (v / 100) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="var(--grid-line)" />
      ))}
      {BARS.map((v, i) => (
        <rect key={i} x={i * step + step * 0.28} y={h - (v / 100) * h} width={step * 0.44} height={(v / 100) * h} rx="3" fill="var(--primary)" opacity={0.35 + (v / 100) * 0.55} />
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function HeroConsole() {
  const t = useTranslations("landing.preview");
  const nav = [LayoutDashboard, Bot, MessagesSquare, FileText, BarChart3, Users, Settings];
  const kpis = [
    { label: t("kpiBots"), value: "4", delta: "+12%" },
    { label: t("kpiMessages"), value: "12,430", delta: "+24%" },
    { label: t("kpiRooms"), value: "3", delta: "+8%" },
    { label: t("kpiSuccess"), value: "96%", delta: "+2%" },
  ];
  const rooms = [
    { name: t("room1"), sub: t("room1Sub"), connected: true },
    { name: t("room2"), sub: t("room2Sub"), connected: true },
    { name: t("room3"), sub: t("room3Sub"), connected: false },
  ];
  return (
    <div className="glass-panel flex h-[520px] w-[760px] overflow-hidden text-fg" aria-hidden>
      <div className="flex w-[148px] shrink-0 flex-col gap-5 border-r border-glass-border px-3 py-5">
        <BrandMark className="px-1 [&_span:last-child]:text-[15px]" />
        <div className="flex flex-col gap-1">
          {nav.map((Icon, i) => (
            <div key={i} className={cn("flex h-9 items-center gap-2 rounded-[10px] px-2.5 text-[12px] text-muted", i === 0 && "glass-card !rounded-[10px] text-fg shadow-none")}>
              <Icon className={cn("size-3.5", i === 0 && "text-primary")} />
              <span>{t(`nav${i}`)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3.5 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[20px] font-semibold leading-7">{t("greeting")}</p>
            <p className="text-[12px] text-muted">{t("greetingSub")}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-7 w-16 rounded-full border border-glass-border bg-input" />
            <span className="size-7 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--accent))]" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {kpis.map((k) => (
            <div key={k.label} className="glass-card !rounded-[14px] p-3">
              <p className="text-[11px] text-muted">{k.label}</p>
              <p className="mt-1 text-[20px] font-semibold tabular leading-6">{k.value}</p>
              <p className="text-[10px] font-medium text-success">{k.delta}</p>
            </div>
          ))}
        </div>
        <div className="glass-card h-[150px] !rounded-[14px] px-3 py-2.5">
          <MiniChart />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1.5fr_1fr] gap-2.5">
          <div className="glass-card !rounded-[14px] p-3">
            <p className="mb-1.5 text-[12px] font-semibold">{t("recentRooms")}</p>
            {rooms.map((r) => (
              <div key={r.name} className="flex h-[30px] items-center gap-2">
                <span className="size-5 rounded-full bg-[linear-gradient(135deg,var(--accent),var(--primary))] opacity-80" />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[11px] font-medium">{r.name}</p>
                  <p className="truncate text-[9px] text-muted">{r.sub}</p>
                </div>
                <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", r.connected ? "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success" : "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-warning")}>
                  {r.connected ? t("connected") : t("waiting")}
                </span>
              </div>
            ))}
          </div>
          <div className="glass-card flex flex-col !rounded-[14px] p-3">
            <p className="mb-1.5 text-[12px] font-semibold">{t("promptSettings")}</p>
            <p className="rounded-[8px] bg-input p-1.5 text-[9px] leading-[13px] text-muted">{t("promptSample")}</p>
            <div className="mt-auto flex items-center justify-between text-[10px]">
              <span>{t("trigger")}</span>
              <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-fg">!AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

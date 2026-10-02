"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { UsageDay } from "@/lib/shared/domain";

type Point = { date: string; requests: number; rate: number | null };

/** ice-cyan bar = 처리 메시지, lavender line = 답변 성공률. 지속 애니메이션 없음, 최초 400ms 이하. */
export function UsageChart({ data, height = 240 }: { data: UsageDay[]; height?: number }) {
  const t = useTranslations("chart");
  const format = useFormatter();
  const points: Point[] = data.map((d) => ({
    date: d.date,
    requests: d.requests,
    rate: d.requests > 0 ? Math.round((d.succeeded / d.requests) * 1000) / 10 : null,
  }));

  const label = (date: string) => format.dateTime(new Date(`${date}T00:00:00Z`), { month: "numeric", day: "numeric", timeZone: "UTC" });

  if (points.length === 0) {
    return <div className="flex items-center justify-center text-body text-muted" style={{ height }}>{t("empty")}</div>;
  }

  return (
    <figure aria-label={t("aria")} className="w-full">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="bar-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.9} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.25} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid-line)" />
            <XAxis
              dataKey="date"
              tickFormatter={label}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="req"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v: number) => format.number(v, { notation: "compact" })}
            />
            <YAxis yAxisId="rate" orientation="right" domain={[(min: number) => Math.max(0, Math.floor(min - 10)), 100]} hide />
            <Tooltip
              cursor={{ fill: "var(--selected-fill)" }}
              contentStyle={{
                background: "var(--surface-solid)",
                border: "1px solid var(--glass-border)",
                borderRadius: 12,
                color: "var(--text)",
                fontSize: 13,
              }}
              labelFormatter={(v) => label(String(v))}
              formatter={(value, name) =>
                name === "rate"
                  ? [value == null ? "—" : `${value}%`, t("successRate")]
                  : [format.number(Number(value)), t("requests")]
              }
            />
            <Bar yAxisId="req" dataKey="requests" fill="url(#bar-fill)" radius={[6, 6, 0, 0]} maxBarSize={18} animationDuration={350} />
            <Line yAxisId="rate" dataKey="rate" type="monotone" stroke="var(--accent)" strokeWidth={2.5} dot={false} animationDuration={350} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-caption text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
          {t("requests")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-accent" aria-hidden />
          {t("successRate")}
        </span>
      </figcaption>
    </figure>
  );
}

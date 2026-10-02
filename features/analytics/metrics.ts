import type { UsageDay } from "@/lib/shared/domain";

export type Totals = { requests: number; succeeded: number; failed: number; successRate: number | null };

export function totals(days: UsageDay[]): Totals {
  const requests = days.reduce((a, d) => a + d.requests, 0);
  const succeeded = days.reduce((a, d) => a + d.succeeded, 0);
  const failed = days.reduce((a, d) => a + d.failed, 0);
  // 표본이 없으면 성공률은 null → 화면에 "—"
  return { requests, succeeded, failed, successRate: requests > 0 ? succeeded / requests : null };
}

/** 마지막 n 일과 그 직전 n 일 */
export function lastNDays(usage: UsageDay[], n: number) {
  const sorted = [...usage].sort((a, b) => a.date.localeCompare(b.date));
  return { current: sorted.slice(-n), previous: sorted.slice(-2 * n, -n) };
}

/** 이번 달(UTC) 누적 */
export function monthToDate(usage: UsageDay[], now = new Date()) {
  const prefix = now.toISOString().slice(0, 7);
  return usage.filter((d) => d.date.startsWith(prefix));
}

export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

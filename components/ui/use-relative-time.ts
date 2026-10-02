"use client";

import { useFormatter, useNow } from "next-intl";

/**
 * "3분 전" 표기. 기준 시각을 1분마다 갱신한다.
 * 1분 미만은 "지금"으로 묶어 서버·클라이언트 렌더의 초 단위 차이로 hydration 이 어긋나지 않게 하고,
 * 클라이언트에서 방금 만든 항목이 미래 시각으로 보이지 않게 한다.
 */
export function useRelativeTime() {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return (d: string | Date) => {
    const date = new Date(d);
    if (Math.abs(now.getTime() - date.getTime()) < 60_000) return format.relativeTime(now, { now, unit: "second" });
    return format.relativeTime(date, { now, unit: Math.abs(now.getTime() - date.getTime()) < 3_600_000 ? "minute" : undefined });
  };
}

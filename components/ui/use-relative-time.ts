"use client";

import { useFormatter, useNow } from "next-intl";

/** "3분 전" 표기. 기준 시각을 1분마다 갱신해 생성 직후 항목이 미래 시각으로 보이지 않게 한다. */
export function useRelativeTime() {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return (d: string | Date) => {
    const date = new Date(d);
    // 클라이언트에서 방금 만든 항목은 now 보다 약간 뒤일 수 있다 → now 로 고정
    return format.relativeTime(date.getTime() > now.getTime() ? now : date, now);
  };
}

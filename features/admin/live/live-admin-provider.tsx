"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { csrfToken } from "@/lib/client/firebase";
import { AdminProvider, type AdminActions, type AdminCtx, type AdminRole } from "../admin-context";

async function send(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-katcha-csrf": csrfToken() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/** 실제 운영자 데이터 계층: /api/v1/admin/* 호출 후 서버 데이터를 다시 읽는다. 권한은 서버가 판정한다. */
export function LiveAdminProvider({ data, role, children }: { data: AdminCtx["data"]; role: AdminRole; children: React.ReactNode }) {
  const router = useRouter();
  const [revealed, setRevealed] = React.useState<Set<string>>(new Set());
  const [revealedText, setRevealedText] = React.useState<Record<string, { input: string; output: string }>>({});

  const actions = React.useMemo<AdminCtx["actions"]>(() => {
    const done = () => router.refresh();
    const a: AdminActions & { exportCsv(days: number, reason: string): Promise<boolean> } = {
      async setMemberStatus(uid, status, reason) {
        await send("PATCH", `/api/v1/admin/members/${encodeURIComponent(uid)}`, { action: "status", status, reason });
        done();
      },
      async setMemberLimit(uid, dailyLimit, reason) {
        await send("PATCH", `/api/v1/admin/members/${encodeURIComponent(uid)}`, { action: "limit", dailyLimit, reason });
        done();
      },
      async revealConversation(id, reason) {
        const res = await send("POST", `/api/v1/admin/conversations/${encodeURIComponent(id)}/reveal`, { reason });
        const { conversation } = (await res.json()) as { conversation: { input: string; output: string } };
        setRevealedText((m) => ({ ...m, [id]: conversation }));
        setRevealed((s) => new Set(s).add(id));
      },
      async retryJob(id) {
        await send("POST", `/api/v1/admin/jobs/${encodeURIComponent(id)}/retry`);
        done();
      },
      async exportCsv(days, reason) {
        try {
          const res = await send("POST", "/api/v1/admin/conversations/export", { days, reason });
          const url = URL.createObjectURL(await res.blob());
          const link = document.createElement("a");
          link.href = url;
          link.download = `katcha-conversations-${days}d.csv`;
          link.click();
          URL.revokeObjectURL(url);
          return true;
        } catch {
          return false;
        }
      },
      // 배경 관리(S7)·입장 처리(별도 화면)는 이 provider 를 쓰지 않는다
      async publishAsset() {},
      async rollback() {},
      addUpload() {},
      async resolveJoin() {},
    };
    return a;
  }, [router]);

  const value = React.useMemo<AdminCtx>(() => ({ mode: "live", role, data, revealed, revealedText, actions }), [role, data, revealed, revealedText, actions]);
  return <AdminProvider value={value}>{children}</AdminProvider>;
}

"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { csrfToken } from "@/lib/client/firebase";
import type { GenJobView } from "@/lib/shared/appearance-gen";
import { AdminProvider, type AdminCtx, type AdminRole } from "../admin-context";

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
  const versionRef = React.useRef(data.appearanceVersion ?? 0);
  React.useEffect(() => {
    versionRef.current = data.appearanceVersion ?? 0;
  }, [data.appearanceVersion]);
  const router = useRouter();
  const [revealed, setRevealed] = React.useState<Set<string>>(new Set());
  const [revealedText, setRevealedText] = React.useState<Record<string, { input: string; output: string }>>({});

  const actions = React.useMemo<AdminCtx["actions"]>(() => {
    const done = () => router.refresh();
    const a: AdminCtx["actions"] = {
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
      async publishAsset(assetId, theme, reason, settings) {
        await send("POST", "/api/v1/admin/appearance/publish", { assetId, theme, settings, reason, expectedVersion: versionRef.current });
        done();
      },
      async rollback(assetId, reason) {
        await send("POST", "/api/v1/admin/appearance/rollback", { assetId, reason, expectedVersion: versionRef.current });
        done();
      },
      async uploadFile(file, theme, label) {
        const form = new FormData();
        form.set("file", file);
        form.set("theme", theme);
        form.set("label", label);
        const res = await fetch("/api/v1/admin/appearance/uploads", { method: "POST", credentials: "same-origin", headers: { "x-katcha-csrf": csrfToken() }, body: form });
        if (res.ok) {
          done();
          return null;
        }
        const j = (await res.json().catch(() => null)) as { error?: { messageKey?: string } } | null;
        return j?.error?.messageKey ?? "errors.network";
      },
      async deleteAsset(assetId) {
        try {
          await send("DELETE", `/api/v1/admin/appearance/assets/${encodeURIComponent(assetId)}`);
          done();
          return true;
        } catch {
          return false;
        }
      },
      async generateBackground(requestId, options) {
        try {
          const res = await fetch("/api/v1/admin/appearance/generate", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json", "x-katcha-csrf": csrfToken() },
            body: JSON.stringify({ requestId, options }),
          });
          const j = (await res.json().catch(() => null)) as { job?: GenJobView; error?: { messageKey?: string } } | null;
          done();
          if (res.ok && j?.job) return { job: j.job };
          return { error: j?.error?.messageKey ?? "errors.network" };
        } catch {
          return { error: "errors.network" };
        }
      },
      // demo 전용 (live 업로드는 uploadFile) / 입장 처리는 별도 화면
      addUpload() {},
      async resolveJoin() {},
    };
    return a;
  }, [router]);

  const value = React.useMemo<AdminCtx>(() => ({ mode: "live", role, data, revealed, revealedText, actions }), [role, data, revealed, revealedText, actions]);
  return <AdminProvider value={value}>{children}</AdminProvider>;
}

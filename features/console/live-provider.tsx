"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { csrfToken } from "@/lib/client/firebase";
import type { Bot, ConsoleSnapshot } from "@/lib/shared/domain";
import { ConsoleProvider, consoleHref, type ActionError, type ConsoleActions, type Result, type WizardDraft } from "./console-context";

// 실제 콘솔 데이터 계층: /api/v1/* 를 호출하고, 변경 후 서버 snapshot 을 다시 읽는다(router.refresh).
// 연결(S4)·AI 답변(S5) 은 아직 API 가 없으므로 "아직 설정되지 않은 기능"으로 정직하게 응답한다.

const KNOWN: ActionError[] = ["conflict", "limit", "validation", "not_found", "not_configured", "network", "invalid_state"];

async function call<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...(method === "GET" ? {} : { "x-katcha-csrf": csrfToken() }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { error?: { code?: string; fieldErrors?: Record<string, string> } } | null;
    if (res.ok) return { ok: true, data: json as T };
    const code = json?.error?.code ?? "";
    const error: ActionError = (KNOWN as string[]).includes(code) ? (code as ActionError) : res.status === 404 ? "not_found" : "network";
    return { ok: false, error, fieldErrors: json?.error?.fieldErrors };
  } catch {
    return { ok: false, error: "network" };
  }
}

const notYet = async <T,>(): Promise<Result<T>> => ({ ok: false, error: "not_configured" });

export function LiveConsoleProvider({ initial, canAdmin, children }: { initial: ConsoleSnapshot; canAdmin: boolean; children: React.ReactNode }) {
  const router = useRouter();

  const actions = React.useMemo<ConsoleActions>(() => {
    const refreshAfter = <T,>(r: Result<T>) => {
      if (r.ok) router.refresh();
      return r;
    };
    const unwrapBot = (r: Result<{ bot: Bot }>): Result<Bot> => (r.ok ? { ok: true, data: r.data.bot } : r);

    return {
      async createBot(input, key) {
        return refreshAfter(unwrapBot(await call<{ bot: Bot }>("POST", "/api/v1/bots", input, { "idempotency-key": key })));
      },
      async updateBot(id, patch, expectedVersion) {
        return refreshAfter(unwrapBot(await call<{ bot: Bot }>("PATCH", `/api/v1/bots/${encodeURIComponent(id)}`, { patch, expectedVersion })));
      },
      async setPaused(id, paused, expectedVersion) {
        return refreshAfter(unwrapBot(await call<{ bot: Bot }>("POST", `/api/v1/bots/${encodeURIComponent(id)}/pause`, { paused, expectedVersion })));
      },
      async deleteBot(id) {
        const r = await call<{ ok: true }>("DELETE", `/api/v1/bots/${encodeURIComponent(id)}`);
        return refreshAfter(r.ok ? { ok: true, data: null } : r);
      },
      async saveDraft(draft) {
        const r = await call<{ draft: WizardDraft }>("PUT", `/api/v1/drafts/${encodeURIComponent(draft.id)}`, { step: draft.step, values: draft.values });
        return r.ok ? { ok: true, data: r.data.draft } : r;
      },
      async loadDraft(id) {
        const r = await call<{ draft: WizardDraft }>("GET", `/api/v1/drafts/${encodeURIComponent(id)}`);
        return r.ok ? { ok: true, data: r.data.draft } : r;
      },
      async discardDraft(id) {
        await call("DELETE", `/api/v1/drafts/${encodeURIComponent(id)}`);
      },
      requestJoin: notYet,
      issuePairingCode: notYet,
      testReply: notYet,
      setRetention: notYet,
    };
  }, [router]);

  const value = React.useMemo(
    () => ({ mode: "live" as const, snapshot: initial, actions, canAdmin, href: (p: string) => consoleHref("live", p) }),
    [initial, actions, canAdmin],
  );
  return <ConsoleProvider value={value}>{children}</ConsoleProvider>;
}

"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { csrfToken } from "@/lib/client/firebase";
import type { Bot, ConsoleSnapshot, JoinRequest, PairingCode, Room } from "@/lib/shared/domain";
import { ConsoleProvider, consoleHref, type ActionError, type ConsoleActions, type Result, type WizardDraft } from "./console-context";

// 실제 콘솔 데이터 계층: /api/v1/* 를 호출하고, 변경 후 서버 snapshot 을 다시 읽는다(router.refresh).

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

export function LiveConsoleProvider({ initial, canAdmin, children }: { initial: ConsoleSnapshot; canAdmin: boolean; children: React.ReactNode }) {
  const router = useRouter();
  // 발급한 연결 코드 원문은 이 탭 메모리에만 둔다. 새로고침하면 다시 발급한다.
  const [codes, setCodes] = React.useState<PairingCode[]>([]);

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
      async requestJoin(botId, input) {
        const r = await call<{ joinRequest: JoinRequest }>("POST", `/api/v1/bots/${encodeURIComponent(botId)}/join-request`, input);
        return refreshAfter(r.ok ? { ok: true, data: r.data.joinRequest } : r);
      },
      async issuePairingCode(botId) {
        const r = await call<{ pairingCode: PairingCode }>("POST", `/api/v1/bots/${encodeURIComponent(botId)}/pairing-token`);
        if (!r.ok) return r;
        setCodes((c) => [...c.filter((x) => x.botId !== botId), r.data.pairingCode]);
        return { ok: true, data: r.data.pairingCode };
      },
      async setRetention(roomId, days) {
        const r = await call<{ room: Room }>("PATCH", `/api/v1/rooms/${encodeURIComponent(roomId)}`, { retentionDays: days });
        return refreshAfter(r.ok ? { ok: true, data: r.data.room } : r);
      },
      // 연결 상태 확인(poll): 서버 snapshot 을 다시 읽는다
      async refresh() {
        router.refresh();
      },
      async testReply(botId, question, _botName, draft) {
        const r = await call<{ reply: { text: string; demo: boolean } }>("POST", `/api/v1/bots/${encodeURIComponent(botId ?? "draft")}/test`, { question, values: botId ? undefined : draft });
        return r.ok ? { ok: true, data: r.data.reply } : r;
      },
    };
  }, [router]);

  const value = React.useMemo(
    () => ({
      mode: "live" as const,
      // 연결된 bot 의 코드는 더 이상 보여주지 않는다
      snapshot: { ...initial, pairingCodes: codes.filter((c) => initial.bots.some((b) => b.id === c.botId && b.state === "awaiting_code")) },
      actions,
      canAdmin,
      href: (p: string) => consoleHref("live", p),
    }),
    [initial, codes, actions, canAdmin],
  );
  return <ConsoleProvider value={value}>{children}</ConsoleProvider>;
}

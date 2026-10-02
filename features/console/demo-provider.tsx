"use client";

import { useLocale } from "next-intl";
import * as React from "react";
import { demoReply } from "@/lib/shared/demo-data";
import type { Bot, ConsoleSnapshot } from "@/lib/shared/domain";
import { BOT_LIMITS } from "@/lib/shared/domain";
import { generatePairingCode } from "@/lib/shared/pairing";
import { botInputSchema, fieldErrors, joinRequestSchema } from "@/lib/shared/schemas";
import {
  ConsoleProvider,
  consoleHref,
  type ConsoleActions,
  type Result,
  type WizardDraft,
} from "./console-context";

// demo 저장소: 이 브라우저 탭의 sessionStorage 에만 둔다. 서버·다른 사용자와 공유되지 않는다.
const STORAGE_KEY = "katcha.demo.v1";

type DemoState = {
  snapshot: ConsoleSnapshot;
  drafts: Record<string, WizardDraft>;
  idempotency: Record<string, string>; // key → botId
};

const wait = (ms = 320) => new Promise((r) => setTimeout(r, ms));
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });

function readStored(): DemoState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoState) : null;
  } catch {
    return null;
  }
}

export function DemoConsoleProvider({ initial, children }: { initial: ConsoleSnapshot; children: React.ReactNode }) {
  const locale = useLocale();
  const [state, setState] = React.useState<DemoState>({ snapshot: initial, drafts: {}, idempotency: {} });
  const stateRef = React.useRef(state);
  // 복원이 반영된 렌더 이후에만 저장한다. (같은 commit 에서 저장하면 초기값이 저장본을 덮어쓴다.)
  const [restored, setRestored] = React.useState(false);

  // 서버 렌더와 일치시키기 위해 마운트 후에 sessionStorage 를 복원한다.
  React.useEffect(() => {
    const stored = readStored();
    if (stored) {
      stateRef.current = stored;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 저장소 1회 복원
      setState(stored);
    }
    setRestored(true);
  }, []);

  React.useEffect(() => {
    stateRef.current = state;
    if (!restored) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode 등: 메모리 상태만 유지 */
    }
  }, [state, restored]);

  const update = React.useCallback((fn: (s: DemoState) => DemoState) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const actions = React.useMemo<ConsoleActions>(() => {
    const now = () => new Date().toISOString();
    const findBot = (id: string) => stateRef.current.snapshot.bots.find((b) => b.id === id);

    return {
      async createBot(input, key) {
        await wait();
        const existing = stateRef.current.idempotency[key];
        if (existing) {
          const bot = findBot(existing);
          if (bot) return ok(bot);
        }
        const parsed = botInputSchema.safeParse(input);
        if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
        const s = stateRef.current.snapshot;
        if (s.bots.length >= s.limits.maxBots) return { ok: false, error: "limit" };
        const bot: Bot = {
          ...parsed.data,
          id: `demo-${crypto.randomUUID().slice(0, 8)}`,
          state: "draft",
          version: 1,
          promptVersion: 1,
          roomLabel: null,
          messages30d: 0,
          createdAt: now(),
          updatedAt: now(),
        };
        update((st) => ({
          ...st,
          idempotency: { ...st.idempotency, [key]: bot.id },
          snapshot: {
            ...st.snapshot,
            bots: [...st.snapshot.bots, bot],
            prompts: [
              ...st.snapshot.prompts,
              { id: `${bot.id}-p1`, botId: bot.id, version: 1, body: bot.customPrompt, faq: bot.faq, createdAt: now() },
            ],
          },
        }));
        return ok(bot);
      },

      async updateBot(id, patch, expectedVersion) {
        await wait();
        const bot = findBot(id);
        if (!bot) return { ok: false, error: "not_found" };
        if (bot.version !== expectedVersion) return { ok: false, error: "conflict" };
        const merged = { ...bot, ...patch };
        const parsed = botInputSchema.safeParse(merged);
        if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
        const promptChanged = merged.customPrompt !== bot.customPrompt || merged.faq !== bot.faq;
        const next: Bot = {
          ...merged,
          version: bot.version + 1,
          promptVersion: promptChanged ? bot.promptVersion + 1 : bot.promptVersion,
          updatedAt: now(),
        };
        update((s) => ({
          ...s,
          snapshot: {
            ...s.snapshot,
            bots: s.snapshot.bots.map((b) => (b.id === id ? next : b)),
            prompts: promptChanged
              ? [
                  ...s.snapshot.prompts,
                  { id: `${id}-p${next.promptVersion}`, botId: id, version: next.promptVersion, body: next.customPrompt, faq: next.faq, createdAt: now() },
                ]
              : s.snapshot.prompts,
            activities: [{ id: crypto.randomUUID(), kind: "settings", botId: id, botName: next.name, at: now() }, ...s.snapshot.activities],
          },
        }));
        return ok(next);
      },

      async setPaused(id, paused, expectedVersion) {
        await wait(220);
        const bot = findBot(id);
        if (!bot) return { ok: false, error: "not_found" };
        if (bot.version !== expectedVersion) return { ok: false, error: "conflict" };
        if (paused ? bot.state !== "active" : bot.state !== "paused") return { ok: false, error: "invalid_state" };
        const next: Bot = { ...bot, state: paused ? "paused" : "active", version: bot.version + 1, updatedAt: now() };
        update((s) => ({
          ...s,
          snapshot: {
            ...s.snapshot,
            bots: s.snapshot.bots.map((b) => (b.id === id ? next : b)),
            rooms: s.snapshot.rooms.map((r) => (r.botId === id ? { ...r, state: paused ? "paused" : "connected" } : r)),
          },
        }));
        return ok(next);
      },

      async deleteBot(id) {
        await wait();
        if (!findBot(id)) return { ok: false, error: "not_found" };
        update((s) => ({
          ...s,
          snapshot: {
            ...s.snapshot,
            bots: s.snapshot.bots.filter((b) => b.id !== id),
            rooms: s.snapshot.rooms.filter((r) => r.botId !== id),
            joinRequests: s.snapshot.joinRequests.filter((j) => j.botId !== id),
            pairingCodes: s.snapshot.pairingCodes.filter((p) => p.botId !== id),
            prompts: s.snapshot.prompts.filter((p) => p.botId !== id),
          },
        }));
        return ok(null);
      },

      async requestJoin(botId, input) {
        await wait();
        const bot = findBot(botId);
        if (!bot) return { ok: false, error: "not_found" };
        if (bot.state !== "draft") return { ok: false, error: "invalid_state" };
        const parsed = joinRequestSchema.safeParse(input);
        if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
        const jr = {
          id: `demo-jr-${crypto.randomUUID().slice(0, 6)}`,
          botId,
          ...parsed.data,
          state: "pending" as const,
          rejectReasonKey: null,
          createdAt: now(),
        };
        update((s) => ({
          ...s,
          snapshot: {
            ...s.snapshot,
            joinRequests: [...s.snapshot.joinRequests.filter((j) => j.botId !== botId), jr],
            bots: s.snapshot.bots.map((b) => (b.id === botId ? { ...b, state: "awaiting_join", version: b.version + 1, updatedAt: now() } : b)),
          },
        }));
        return ok(jr);
      },

      async issuePairingCode(botId) {
        await wait(260);
        const bot = findBot(botId);
        if (!bot) return { ok: false, error: "not_found" };
        // 운영자 입장 승인(awaiting_code) 전에는 코드를 발급하지 않는다.
        if (bot.state !== "awaiting_code") return { ok: false, error: "invalid_state" };
        const code = {
          botId,
          code: generatePairingCode(),
          expiresAt: new Date(Date.now() + BOT_LIMITS.pairingTtlMinutes * 60_000).toISOString(),
        };
        // 재발급 시 이전 코드는 폐기
        update((s) => ({
          ...s,
          snapshot: { ...s.snapshot, pairingCodes: [...s.snapshot.pairingCodes.filter((p) => p.botId !== botId), code] },
        }));
        return ok(code);
      },

      async testReply(botId, question, botName) {
        await wait(700);
        if (question.trim() === "") return { ok: false, error: "validation" };
        void botId;
        return ok({ text: demoReply(question, botName, locale), demo: true });
      },

      async setRetention(roomId, days) {
        await wait(200);
        const room = stateRef.current.snapshot.rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, error: "not_found" };
        const next = { ...room, retentionDays: days };
        update((s) => ({ ...s, snapshot: { ...s.snapshot, rooms: s.snapshot.rooms.map((r) => (r.id === roomId ? next : r)) } }));
        return ok(next);
      },

      async saveDraft(draft) {
        const saved = { ...draft, updatedAt: now() };
        update((s) => ({ ...s, drafts: { ...s.drafts, [draft.id]: saved } }));
        return ok(saved);
      },

      async loadDraft(id) {
        const d = stateRef.current.drafts[id];
        return d ? ok(d) : { ok: false, error: "not_found" };
      },

      async discardDraft(id) {
        update((s) => {
          const drafts = { ...s.drafts };
          delete drafts[id];
          return { ...s, drafts };
        });
      },

      simulate: {
        operatorJoined(botId) {
          update((s) => ({
            ...s,
            snapshot: {
              ...s.snapshot,
              joinRequests: s.snapshot.joinRequests.map((j) => (j.botId === botId && j.state === "pending" ? { ...j, state: "awaiting_code" } : j)),
              bots: s.snapshot.bots.map((b) => (b.id === botId && b.state === "awaiting_join" ? { ...b, state: "awaiting_code", version: b.version + 1 } : b)),
            },
          }));
        },
        codeSentInRoom(botId) {
          const s0 = stateRef.current.snapshot;
          const code = s0.pairingCodes.find((p) => p.botId === botId);
          const bot = s0.bots.find((b) => b.id === botId);
          const jr = s0.joinRequests.find((j) => j.botId === botId);
          if (!code || !bot || bot.state !== "awaiting_code" || new Date(code.expiresAt).getTime() < Date.now()) return;
          const label = jr?.roomLabel || bot.name;
          update((s) => ({
            ...s,
            snapshot: {
              ...s.snapshot,
              pairingCodes: s.snapshot.pairingCodes.filter((p) => p.botId !== botId),
              joinRequests: s.snapshot.joinRequests.map((j) => (j.botId === botId ? { ...j, state: "connected" } : j)),
              bots: s.snapshot.bots.map((b) => (b.id === botId ? { ...b, state: "active", roomLabel: label, version: b.version + 1, updatedAt: now() } : b)),
              rooms: [
                ...s.snapshot.rooms,
                { id: `demo-room-${botId}`, botId, label, state: "connected", lastMessageAt: null, messages7d: 0, retentionDays: 30 },
              ],
              activities: [{ id: crypto.randomUUID(), kind: "connected", botId, botName: bot.name, at: now() }, ...s.snapshot.activities],
            },
          }));
        },
        reset() {
          try {
            window.sessionStorage.removeItem(STORAGE_KEY);
          } catch {}
          update(() => ({ snapshot: initial, drafts: {}, idempotency: {} }));
        },
      },
    };
  }, [update, locale, initial]);

  const value = React.useMemo(
    () => ({ mode: "demo" as const, snapshot: state.snapshot, actions, href: (p: string) => consoleHref("demo", p) }),
    [state.snapshot, actions],
  );

  return <ConsoleProvider value={value}>{children}</ConsoleProvider>;
}

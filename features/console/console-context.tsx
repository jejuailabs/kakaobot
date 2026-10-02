"use client";

import * as React from "react";
import type { Bot, ConsoleSnapshot, JoinRequest, PairingCode, Room } from "@/lib/shared/domain";
import type { BotInput, JoinRequestInput } from "@/lib/shared/schemas";

export type ConsoleMode = "demo" | "live";

export type ActionError =
  | "conflict"
  | "limit"
  | "validation"
  | "not_found"
  | "not_configured"
  | "network"
  | "invalid_state";

export type Result<T> = { ok: true; data: T } | { ok: false; error: ActionError; fieldErrors?: Record<string, string> };

export type WizardDraft = {
  id: string;
  step: number;
  values: BotInput;
  updatedAt: string;
};

export type ConsoleActions = {
  createBot(input: BotInput, idempotencyKey: string): Promise<Result<Bot>>;
  updateBot(id: string, patch: Partial<BotInput>, expectedVersion: number): Promise<Result<Bot>>;
  setPaused(id: string, paused: boolean, expectedVersion: number): Promise<Result<Bot>>;
  deleteBot(id: string): Promise<Result<null>>;
  requestJoin(botId: string, input: JoinRequestInput): Promise<Result<JoinRequest>>;
  issuePairingCode(botId: string): Promise<Result<PairingCode>>;
  testReply(botId: string | null, question: string, botName: string, draft?: BotInput): Promise<Result<{ text: string; demo: boolean }>>;
  setRetention(roomId: string, days: Room["retentionDays"]): Promise<Result<Room>>;
  saveDraft(draft: Omit<WizardDraft, "updatedAt">): Promise<Result<WizardDraft>>;
  loadDraft(id: string): Promise<Result<WizardDraft>>;
  discardDraft(id: string): Promise<void>;
  /** live: 서버 상태 다시 읽기 (연결 대기 poll) */
  refresh?(): Promise<void>;
  /** demo 전용: 운영자 입장 확인 / 방에서 코드 전송을 흉내낸다. live 에서는 undefined. */
  simulate?: {
    operatorJoined(botId: string): void;
    codeSentInRoom(botId: string): void;
    reset(): void;
  };
};

export type ConsoleContextValue = {
  mode: ConsoleMode;
  snapshot: ConsoleSnapshot;
  actions: ConsoleActions;
  /** 콘솔 내부 경로 → locale 제외 실제 URL */
  href(path: string): string;
  /** 서버가 확인한 운영자 권한이 있을 때만 true. 메뉴 표시용이며 보호는 서버 layout 이 한다. */
  canAdmin?: boolean;
};

const ConsoleContext = React.createContext<ConsoleContextValue | null>(null);

export function ConsoleProvider({ value, children }: { value: ConsoleContextValue; children: React.ReactNode }) {
  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole() {
  const ctx = React.useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used inside ConsoleProvider");
  return ctx;
}

export function consoleHref(mode: ConsoleMode, path: string) {
  const clean = path.replace(/^\/+/, "");
  if (mode === "demo") return clean === "dashboard" || clean === "" ? "/demo" : `/demo/${clean}`;
  return `/${clean || "dashboard"}`;
}

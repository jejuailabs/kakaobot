"use client";

import * as React from "react";
import type { ConsoleSnapshot } from "@/lib/shared/domain";
import { ConsoleProvider, consoleHref, type ConsoleActions, type Result } from "./console-context";

// 실제 콘솔 데이터 계층. S2 에서는 로그인·workspace 까지만 연결되어 있고,
// 챗봇 CRUD(S3)·연결(S4)·AI 답변(S5) API 는 아직 없으므로 "아직 설정되지 않은 기능"으로 정직하게 응답한다.
const notYet = async <T,>(): Promise<Result<T>> => ({ ok: false, error: "not_configured" });

export function LiveConsoleProvider({ initial, canAdmin, children }: { initial: ConsoleSnapshot; canAdmin: boolean; children: React.ReactNode }) {
  const actions = React.useMemo<ConsoleActions>(
    () => ({
      createBot: notYet,
      updateBot: notYet,
      setPaused: notYet,
      deleteBot: notYet,
      requestJoin: notYet,
      issuePairingCode: notYet,
      testReply: notYet,
      setRetention: notYet,
      saveDraft: notYet,
      loadDraft: notYet,
      async discardDraft() {},
    }),
    [],
  );
  const value = React.useMemo(
    () => ({ mode: "live" as const, snapshot: initial, actions, canAdmin, href: (p: string) => consoleHref("live", p) }),
    [initial, actions, canAdmin],
  );
  return <ConsoleProvider value={value}>{children}</ConsoleProvider>;
}

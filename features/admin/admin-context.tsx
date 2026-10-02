"use client";

import * as React from "react";
import type { DemoAdminData, DemoAsset, MemberStatus } from "@/lib/shared/demo-admin";
import type { GenerationInfo, GenJobView, GenOptions } from "@/lib/shared/appearance-gen";
import type { UsageDay } from "@/lib/shared/domain";

// 운영자 화면 데이터 계층. demo 는 이 탭 메모리에서만 바뀐다. live 는 S6/S7 에서 /api/v1/admin/* 로 연결한다.

export type AdminRole = "superadmin" | "support" | "analyst" | "designer";

export type AdminActions = {
  setMemberStatus(uid: string, status: MemberStatus, reason: string): Promise<void>;
  setMemberLimit(uid: string, dailyLimit: number, reason: string): Promise<void>;
  revealConversation(id: string, reason: string): Promise<void>;
  publishAsset(assetId: string, theme: "light" | "dark", reason: string, settings: AppearanceSettings): Promise<void>;
  rollback(assetId: string, reason: string): Promise<void>;
  addUpload(asset: DemoAsset): void;
  retryJob(id: string): Promise<void>;
  resolveJoin(id: string, decision: "joined" | "rejected"): Promise<void>;
};

export type AppearanceSettings = { overlay: number; blur: number; brightness: number; scope: "all" | "dashboard" | "landing" };

export type AdminMetrics = {
  members: number;
  newMembers30d: number;
  dau: number;
  mau: number;
  activeBots: number;
  rooms: number;
  p95LatencyMs: number | null;
  monthCostMicros: number;
  modelShare: { label: string; value: number }[];
  errors: { key: string; value: number }[];
};

export type AdminCtx = {
  mode: "demo" | "live";
  role: AdminRole;
  data: DemoAdminData & { usage?: UsageDay[]; metrics?: AdminMetrics; appearanceVersion?: number; imageGen?: GenerationInfo };
  revealed: Set<string>;
  /** live: 서버에서 받은 원문 (열람한 건만) */
  revealedText?: Record<string, { input: string; output: string }>;
  actions: AdminActions & {
    exportCsv?(days: number, reason: string): Promise<boolean>;
    /** live: 서버 업로드 (성공 시 null, 실패 시 오류 메시지 key) */
    uploadFile?(file: Blob, theme: "light" | "dark", label: string): Promise<string | null>;
    deleteAsset?(assetId: string): Promise<boolean>;
    /** live: AI 배경 생성 (성공 시 job, 실패 시 오류 메시지 key) */
    generateBackground?(requestId: string, options: GenOptions): Promise<{ job: GenJobView } | { error: string }>;
  };
};

const AdminContext = React.createContext<AdminCtx | null>(null);

export function AdminProvider({ value, children }: { value: AdminCtx; children: React.ReactNode }) {
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const c = React.useContext(AdminContext);
  if (!c) throw new Error("useAdmin outside AdminProvider");
  return c;
}

const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export function DemoAdminProvider({ initial, children }: { initial: DemoAdminData; children: React.ReactNode }) {
  const [data, setData] = React.useState(initial);
  const [revealed, setRevealed] = React.useState<Set<string>>(new Set());

  const audit = React.useCallback((action: string, target: string, reason: string) => {
    setData((d) => ({
      ...d,
      audit: [{ id: crypto.randomUUID(), actor: "demo-operator", role: "superadmin", action, target, reason, at: new Date().toISOString() }, ...d.audit],
    }));
  }, []);

  const actions = React.useMemo<AdminActions>(
    () => ({
      async setMemberStatus(uid, status, reason) {
        await wait();
        setData((d) => ({ ...d, members: d.members.map((m) => (m.uid === uid ? { ...m, status } : m)) }));
        audit(status === "suspended" ? "member.suspend" : "member.restore", uid, reason);
      },
      async setMemberLimit(uid, dailyLimit, reason) {
        await wait();
        setData((d) => ({ ...d, members: d.members.map((m) => (m.uid === uid ? { ...m, dailyLimit } : m)) }));
        audit("member.limit", `${uid} → ${dailyLimit}`, reason);
      },
      async revealConversation(id, reason) {
        await wait();
        setRevealed((s) => new Set(s).add(id));
        audit("conversation.reveal", id, reason);
      },
      async publishAsset(assetId, theme, reason, settings) {
        await wait(500);
        setData((d) => ({
          ...d,
          assets: d.assets.map((a) =>
            a.theme !== theme ? a : a.id === assetId ? { ...a, state: "active" } : a.state === "active" ? { ...a, state: "previous" } : a,
          ),
        }));
        audit("appearance.publish", `${assetId} (${theme}) overlay ${settings.overlay} blur ${settings.blur}px`, reason);
      },
      async rollback(assetId, reason) {
        await wait(400);
        let theme: "light" | "dark" = "dark";
        setData((d) => {
          const target = d.assets.find((a) => a.id === assetId);
          if (target) theme = target.theme;
          return {
            ...d,
            assets: d.assets.map((a) =>
              a.theme !== theme ? a : a.id === assetId ? { ...a, state: "active" } : a.state === "active" ? { ...a, state: "previous" } : a,
            ),
          };
        });
        audit("appearance.rollback", assetId, reason);
      },
      addUpload(asset) {
        setData((d) => ({ ...d, assets: [asset, ...d.assets] }));
      },
      async retryJob(id) {
        await wait();
        setData((d) => ({ ...d, jobs: d.jobs.filter((j) => j.id !== id) }));
        audit("job.retry", id, "manual retry");
      },
      async resolveJoin(id, decision) {
        await wait();
        setData((d) => ({
          ...d,
          joinQueue: d.joinQueue.map((q) => (q.id === id ? { ...q, state: decision === "joined" ? "awaiting_code" : "rejected" } : q)),
        }));
        audit(decision === "joined" ? "join.approve" : "join.reject", id, decision);
      },
    }),
    [audit],
  );

  const value = React.useMemo(() => ({ mode: "demo" as const, role: "superadmin" as const, data, revealed, actions }), [data, revealed, actions]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

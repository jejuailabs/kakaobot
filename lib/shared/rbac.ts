// 운영자 RBAC (docs/05). 권한 판정은 항상 서버에서 한다 — 프런트 메뉴 숨김만으로 보호하지 않는다.

export const ADMIN_ROLES = ["superadmin", "support", "analyst", "designer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export type Permission =
  | "admin.view"
  | "metrics.view"
  | "members.view"
  | "members.manage"
  | "conversations.view"
  | "conversations.reveal"
  | "conversations.export"
  | "audit.view"
  | "appearance.manage"
  | "joins.manage"
  | "jobs.manage"
  | "gateways.view";

const GRANTS: Record<AdminRole, readonly Permission[]> = {
  superadmin: [
    "admin.view",
    "metrics.view",
    "members.view",
    "members.manage",
    "conversations.view",
    "conversations.reveal",
    "conversations.export",
    "audit.view",
    "appearance.manage",
    "joins.manage",
    "jobs.manage",
    "gateways.view",
  ],
  // 원문 열람은 별도 permission 이 필요하므로 support 기본 권한에 넣지 않는다.
  support: ["admin.view", "members.view", "conversations.view", "joins.manage", "jobs.manage", "gateways.view"],
  analyst: ["admin.view", "metrics.view"],
  designer: ["admin.view", "appearance.manage"],
};

export function can(roles: readonly AdminRole[], permission: Permission): boolean {
  return roles.some((r) => GRANTS[r]?.includes(permission));
}

/**
 * 운영자 이메일 (사용자 결정, 2026-10-04): OPERATOR_EMAILS="a@x.com,b@y.com" 에 있는 이메일을 superadmin 으로 본다.
 * Google 로그인 + Google 이 인증한 이메일만 인정, 대소문자·공백 무시. docs/05 와 다른 방식이며 docs/08 에 기록.
 */
export function isOperatorEmail(email: string | undefined, verified: boolean, provider: string | undefined, raw: string | undefined = process.env.OPERATOR_EMAILS): boolean {
  if (!email || !verified || provider !== "google.com" || !raw) return false;
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}

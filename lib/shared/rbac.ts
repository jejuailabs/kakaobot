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

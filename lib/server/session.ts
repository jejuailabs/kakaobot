import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { ADMIN_ROLES, isOperatorEmail, type AdminRole } from "@/lib/shared/rbac";
import { adminAuth, isAdminConfigured } from "./firebase-admin";
import { getUserRecord, workspaceIdFor, type UserStatus } from "./workspace";

export const SESSION_COOKIE = "katcha_session";

export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 최대 5일 (docs/05)

export type SessionUser = {
  uid: string;
  email: string;
  displayName: string;
  /** 항상 session uid 에서 결정한다. 클라이언트가 보낸 workspaceId 는 쓰지 않는다. */
  workspaceId: string;
  status: UserStatus;
  /** 운영자 역할은 Firebase custom claim(roles) 에서만 읽는다. 이메일로 판정하지 않는다. */
  roles: AdminRole[];
};

/**
 * Firebase session cookie 를 서버에서 검증한다 (폐기 여부 포함).
 * 검증 실패·미설정이면 null — 쿠키 존재만으로 로그인으로 취급하지 않는다.
 * 같은 요청 안에서는 한 번만 검증한다.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isAdminConfigured()) return null;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    const record = await getUserRecord(decoded.uid);
    const claimRoles = Array.isArray(decoded.roles) ? (decoded.roles as unknown[]) : [];
    // 운영자 이메일 (사용자 결정, 2026-10-04): OPERATOR_EMAILS 에 있고 Google 에서 인증된 이메일이면 superadmin.
    // docs/05 의 "이메일로 권한 판정 금지"와 다른 운영 방식이며 docs/08 에 기록했다. custom claim 방식도 함께 유효.
    if (isOperatorEmail(decoded.email, decoded.email_verified === true, decoded.firebase?.sign_in_provider)) claimRoles.push("superadmin");
    return {
      uid: decoded.uid,
      email: record?.email ?? decoded.email ?? "",
      displayName: record?.displayName ?? (decoded.name as string | undefined) ?? decoded.email ?? "",
      workspaceId: record?.workspaceId ?? workspaceIdFor(decoded.uid),
      status: record?.status ?? "active",
      roles: claimRoles.filter((r): r is AdminRole => typeof r === "string" && (ADMIN_ROLES as readonly string[]).includes(r)),
    };
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    // 만료·폐기·위조 같은 인증 오류는 로그인 필요. 그 외(네트워크 등)는 원인을 남긴다.
    if (!code.startsWith("auth/")) console.error("[session] verify failed (non-auth)", { code, message: (e as Error).message?.slice(0, 200) });
    return null;
  }
});

import "server-only";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "katcha_session";

export type SessionUser = { uid: string; email: string; displayName: string; roles: string[] };

/**
 * S2 에서 Firebase Admin verifySessionCookie 로 교체한다.
 * 지금은 검증 수단이 없으므로 항상 null 을 반환한다 — 쿠키 존재만으로 로그인으로 취급하지 않는다.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  void jar.get(SESSION_COOKIE);
  return null;
}

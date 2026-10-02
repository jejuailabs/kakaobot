import "server-only";
import type { NextRequest } from "next/server";

export const CSRF_COOKIE = "katcha_csrf";
export const CSRF_HEADER = "x-katcha-csrf";

/** 같은 origin 에서 온 요청인지 확인한다. Origin 헤더가 없으면 거절한다. */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set<string>([req.nextUrl.origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    } catch {}
  }
  return allowed.has(origin);
}

/** double-submit CSRF: 쿠키 값과 헤더 값이 같고 충분히 길어야 한다. */
export function hasValidCsrf(req: NextRequest): boolean {
  const cookie = req.cookies.get(CSRF_COOKIE)?.value ?? "";
  const header = req.headers.get(CSRF_HEADER) ?? "";
  if (cookie.length < 32 || cookie.length > 128) return false;
  if (cookie.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < cookie.length; i++) diff |= cookie.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

export function requestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function errorBody(code: string, messageKey: string, rid = requestId()) {
  return { error: { code, messageKey, requestId: rid } };
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { adminAuth, isAdminConfigured } from "@/lib/server/firebase-admin";
import { errorBody, hasValidCsrf, isSameOrigin } from "@/lib/server/request-guard";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/server/session";
import { ensureUserAndWorkspace } from "@/lib/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  idToken: z.string().min(100).max(4096),
  locale: z.enum(routing.locales).default("ko"),
});

const RECENT_SIGN_IN_SEC = 5 * 60;

function guard(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json(errorBody("forbidden_origin", "errors.forbidden"), { status: 403 });
  if (!hasValidCsrf(req)) return NextResponse.json(errorBody("csrf_failed", "errors.forbidden"), { status: 403 });
  return null;
}

/** POST /api/v1/auth/session — Firebase ID token → HttpOnly session cookie */
export async function POST(req: NextRequest) {
  try {
    return await createSession(req);
  } catch (e) {
    // 예상하지 못한 오류: 원인 코드만 서버 로그에 남기고 고객에게는 stacktrace 를 주지 않는다.
    const body = errorBody("internal", "login.errorGeneric");
    console.error("[auth/session] unexpected", { requestId: body.error.requestId, code: (e as { code?: unknown }).code, message: (e as Error).message?.slice(0, 200) });
    return NextResponse.json(body, { status: 500 });
  }
}

async function createSession(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  if (!isAdminConfigured()) return NextResponse.json(errorBody("not_configured", "errors.not_configured"), { status: 503 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(errorBody("validation", "errors.validation"), { status: 400 });

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(parsed.data.idToken, true);
  } catch {
    return NextResponse.json(errorBody("invalid_token", "login.errorInvalid"), { status: 401 });
  }
  // 방금 로그인한 토큰으로만 session 을 만든다 (탈취된 오래된 토큰 재사용 방지).
  if (Date.now() / 1000 - decoded.auth_time > RECENT_SIGN_IN_SEC) {
    return NextResponse.json(errorBody("stale_sign_in", "login.errorStale"), { status: 401 });
  }
  if (decoded.firebase?.sign_in_provider !== "google.com") {
    return NextResponse.json(errorBody("provider_not_allowed", "login.errorInvalid"), { status: 401 });
  }

  let user;
  try {
    user = await ensureUserAndWorkspace({
      uid: decoded.uid,
      email: decoded.email ?? "",
      displayName: (decoded.name as string | undefined) ?? decoded.email?.split("@")[0] ?? "",
      locale: parsed.data.locale,
    });
  } catch (e) {
    console.error("[auth/session] workspace bootstrap failed", { uid: decoded.uid, code: (e as { code?: unknown }).code });
    return NextResponse.json(errorBody("db_unavailable", "errors.network"), { status: 503 });
  }
  if (user.status !== "active") {
    return NextResponse.json(errorBody("account_suspended", "login.errorSuspended"), { status: 403 });
  }

  let sessionCookie: string;
  try {
    sessionCookie = await adminAuth().createSessionCookie(parsed.data.idToken, { expiresIn: SESSION_MAX_AGE_MS });
  } catch (e) {
    const body = errorBody("session_create_failed", "login.errorGeneric");
    console.error("[auth/session] createSessionCookie failed", { requestId: body.error.requestId, code: (e as { code?: unknown }).code });
    return NextResponse.json(body, { status: 500 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return res;
}

/** DELETE /api/v1/auth/session — logout (이 기기의 cookie 제거) */
export async function DELETE(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

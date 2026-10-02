import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { errorBody, hasValidCsrf, isSameOrigin, requestId } from "./request-guard";
import { getSessionUser, type SessionUser } from "./session";

export type ApiError = { status: number; code: string; messageKey: string; fieldErrors?: Record<string, string> };

export function apiError(status: number, code: string, messageKey = `errors.${code}`, fieldErrors?: Record<string, string>): ApiError {
  return { status, code, messageKey, fieldErrors };
}

export function isApiError(v: unknown): v is ApiError {
  return typeof v === "object" && v !== null && "status" in v && "code" in v && "messageKey" in v;
}

function errorResponse(e: ApiError, rid: string) {
  return NextResponse.json({ error: { code: e.code, messageKey: e.messageKey, requestId: rid, fieldErrors: e.fieldErrors } }, { status: e.status });
}

type Handler<C> = (ctx: { req: NextRequest; user: SessionUser; params: C }) => Promise<NextResponse | unknown>;

/**
 * 고객 업무 API 공통 처리:
 * - 변경 요청은 Origin + CSRF 검사
 * - 검증된 session 필수, 정지 회원 거절
 * - workspace 는 session 에서만 결정 (body/query 의 workspaceId 무시)
 * - 예외는 requestId 와 함께 로그, 고객에게 stacktrace 미반환
 */
export function userRoute<C = Record<string, string>>(handler: Handler<C>, opts: { mutation?: boolean } = {}) {
  return async (req: NextRequest, ctx: { params: Promise<C> }) => {
    const rid = requestId();
    try {
      if (opts.mutation) {
        if (!isSameOrigin(req)) return NextResponse.json(errorBody("forbidden_origin", "errors.forbidden", rid), { status: 403 });
        if (!hasValidCsrf(req)) return NextResponse.json(errorBody("csrf_failed", "errors.forbidden", rid), { status: 403 });
      }
      const user = await getSessionUser();
      if (!user) return NextResponse.json(errorBody("unauthenticated", "errors.unauthenticated", rid), { status: 401 });
      if (user.status !== "active") return NextResponse.json(errorBody("account_suspended", "login.errorSuspended", rid), { status: 403 });
      const result = await handler({ req, user, params: await ctx.params });
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (isApiError(e)) return errorResponse(e, rid);
      console.error("[api] unexpected", { requestId: rid, path: req.nextUrl.pathname, code: (e as { code?: unknown }).code, message: (e as Error).message?.slice(0, 200) });
      return NextResponse.json(errorBody("internal", "errors.internal", rid), { status: 500 });
    }
  };
}

export async function readJson(req: NextRequest, maxBytes = 64_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw apiError(413, "payload_too_large", "errors.validation");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw apiError(400, "validation", "errors.validation");
  }
}

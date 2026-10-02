import { adminRoute, apiError, readJson } from "@/lib/server/api";
import { generateBackground } from "@/lib/server/appearance";
import { isGenOptions } from "@/lib/shared/appearance-gen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // provider timeout 90초 × 최대 2회 + 재인코딩

/**
 * AI 배경 생성 (OpenAI Image API, low 품질). body: { requestId, options:{theme,scene,palette,season,custom} }.
 * requestId 가 같으면 같은 job 을 돌려준다. 결과는 private draft — 적용은 별도(사유·감사).
 * provider 미설정이면 503 not_configured, 업로드는 무관하게 동작 (docs/07).
 */
export const POST = adminRoute(
  "appearance.manage",
  async ({ req, user }) => {
    const b = (await readJson(req)) as { requestId?: unknown; options?: unknown };
    if (typeof b.requestId !== "string" || !isGenOptions(b.options)) throw apiError(400, "validation", "errors.validation");
    return { job: await generateBackground(user, b.requestId, b.options) };
  },
  { mutation: true },
);

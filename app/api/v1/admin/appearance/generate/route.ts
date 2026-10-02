import { adminRoute, apiError } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI 배경 생성: 이미지 생성 provider(IMAGE_PROVIDER_API_KEY) 가 설정되지 않으면 미설정으로 응답한다.
 * 업로드는 이와 무관하게 동작한다 (docs/07).
 */
export const POST = adminRoute(
  "appearance.manage",
  async () => {
    if (!process.env.IMAGE_PROVIDER_API_KEY) throw apiError(503, "not_configured", "errors.not_configured");
    throw apiError(501, "not_configured", "errors.not_configured");
  },
  { mutation: true },
);

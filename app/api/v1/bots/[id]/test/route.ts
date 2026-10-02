import { readJson, userRoute } from "@/lib/server/api";
import { testReply } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 실제 모델 호출 테스트. 사용량·비용·한도가 적용된다. */
export const POST = userRoute<{ id: string }>(
  async ({ req, user, params }) => {
    const body = (await readJson(req)) as { question?: unknown; values?: unknown };
    const q = typeof body.question === "string" ? body.question : "";
    // "draft" 는 wizard 에서 저장 전 설정값으로 테스트할 때 쓰는 예약 ID
    return { reply: params.id === "draft" ? await testReply(user.workspaceId, null, q, body.values) : await testReply(user.workspaceId, params.id, q) };
  },
  { mutation: true },
);

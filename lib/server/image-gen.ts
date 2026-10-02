import "server-only";

// 배경 이미지 생성 provider (docs/07 "AI 배경생성"). 서버 전용 adapter — 키·모델·baseURL 은 서버 allowlist 로만 관리.
// OpenAI Image API 는 동기 응답(b64)이라 submit→poll 이 한 번의 요청으로 끝난다. job 상태는 lib/server/appearance.ts 가 관리.

export type ImageModelSpec = {
  id: string;
  /** USD per 1M tokens (developers.openai.com/api/docs/models/gpt-image-2.5-flare, 2026-10-03 확인) */
  price: { textInput: number; imageOutput: number };
  quality: "low";
  size: string;
};

/** 2048x1152(16:9): 업로드 최소 폭 1600px 을 넘기는 가장 작은 16 배수 16:9 크기에 가깝게. low 실측 출력 157 token ≈ $0.005/장 */
export const IMAGE_MODEL: ImageModelSpec = { id: "gpt-image-2.5-flare", price: { textInput: 5, imageOutput: 30 }, quality: "low", size: "2048x1152" };

export function isImageGenConfigured(): boolean {
  return process.env.LLM_PROVIDER === "openai" && Boolean(process.env.LLM_PROVIDER_API_KEY?.startsWith("sk-"));
}

export function imageCostMicros(inputTokens: number, outputTokens: number, m: ImageModelSpec = IMAGE_MODEL): number {
  return Math.ceil(inputTokens * m.price.textInput + outputTokens * m.price.imageOutput);
}

export class ImageGenError extends Error {
  constructor(
    readonly kind: "rate_limited" | "server" | "timeout" | "bad_request" | "moderation" | "auth" | "not_configured" | "empty",
    readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
  /** 확정 429/5xx 만 재시도 대상. timeout·연결 끊김은 생성·과금 여부가 불명이라 재시도하지 않는다. */
  get retryable() {
    return this.kind === "rate_limited" || this.kind === "server";
  }
  /** 요청이 provider 에 도달해 처리됐을 수도 있는 상태 */
  get unknown() {
    return this.kind === "timeout";
  }
}

export type ImageResult = { data: Buffer; inputTokens: number; outputTokens: number; providerRequestId: string | null };

type ImagesApiOutput = {
  data?: { b64_json?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; code?: string | null } | null;
};

export async function generateImage(input: { prompt: string; requestId: string; timeoutMs: number }): Promise<ImageResult> {
  if (!isImageGenConfigured()) throw new ImageGenError("not_configured", null, "image provider not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), input.timeoutMs);
  let res: Response;
  let body: ImagesApiOutput;
  try {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        authorization: `Bearer ${process.env.LLM_PROVIDER_API_KEY}`,
        "content-type": "application/json",
        "x-client-request-id": input.requestId,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL.id,
        prompt: input.prompt,
        size: IMAGE_MODEL.size,
        quality: IMAGE_MODEL.quality,
        output_format: "webp",
        output_compression: 90,
        n: 1,
      }),
    });
    body = (await res.json().catch(() => ({}))) as ImagesApiOutput;
  } catch (e) {
    // 요청을 보낸 뒤 끊긴 경우도 생성 여부를 알 수 없으므로 timeout 과 같이 다룬다
    throw new ImageGenError("timeout", null, (e as Error).name === "AbortError" ? "provider timeout" : (e as Error).message.slice(0, 200));
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const msg = body.error?.message?.slice(0, 200) ?? `HTTP ${res.status}`;
    const kind =
      res.status === 429 ? "rate_limited" : res.status >= 500 ? "server" : res.status === 401 || res.status === 403 ? "auth" : body.error?.code === "moderation_blocked" ? "moderation" : "bad_request";
    throw new ImageGenError(kind, res.status, msg);
  }
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new ImageGenError("empty", res.status, "no image in response");
  return {
    data: Buffer.from(b64, "base64"),
    inputTokens: body.usage?.input_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
    providerRequestId: res.headers.get("x-request-id"),
  };
}

import "server-only";

// LLM provider 추상화 (docs/07). 모델·키·baseURL 은 서버 allowlist 로만 관리한다 (임의 baseURL 입력 금지).

export type ModelSpec = {
  id: string;
  label: string;
  provider: "openai";
  /** USD per 1M tokens (developers.openai.com/api/docs/pricing, 2026-10-03 확인) */
  price: { input: number; cachedInput: number; output: number };
  reasoningEffort?: "none" | "low" | "medium";
};

export const MODELS: Record<string, ModelSpec> = {
  "gpt-6-luna": { id: "gpt-6-luna", label: "GPT-6 Luna", provider: "openai", price: { input: 0.1, cachedInput: 0.01, output: 0.5 }, reasoningEffort: "low" },
};

/** bot.modelId "default" 는 현재 기본 모델로 해석한다. */
export const DEFAULT_MODEL = "gpt-6-luna";

export function resolveModel(modelId: string): ModelSpec {
  return MODELS[modelId] ?? MODELS[DEFAULT_MODEL];
}

export function isLlmConfigured(): boolean {
  return process.env.LLM_PROVIDER === "openai" && Boolean(process.env.LLM_PROVIDER_API_KEY?.startsWith("sk-"));
}

export type GenerateInput = {
  model: ModelSpec;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxOutputTokens: number;
  timeoutMs: number;
  requestId: string;
};

export type GenerateResult = {
  text: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  providerRequestId: string | null;
  truncated: boolean;
};

export class LlmError extends Error {
  constructor(
    readonly kind: "rate_limited" | "server" | "timeout" | "bad_request" | "auth" | "not_configured" | "empty",
    readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
  /** 확정 429/5xx 만 재시도 대상. timeout 은 처리 여부가 불명이므로 재시도하지 않는다. */
  get retryable() {
    return this.kind === "rate_limited" || this.kind === "server";
  }
}

export function costMicros(model: ModelSpec, inputTokens: number, outputTokens: number, cachedInputTokens = 0): number {
  const uncached = Math.max(0, inputTokens - cachedInputTokens);
  const usd = (uncached * model.price.input + cachedInputTokens * model.price.cachedInput + outputTokens * model.price.output) / 1_000_000;
  return Math.ceil(usd * 1_000_000);
}

type ResponsesApiOutput = {
  id?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: { type: string; content?: { type: string; text?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
  error?: { message?: string } | null;
};

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  if (!isLlmConfigured()) throw new LlmError("not_configured", null, "LLM provider not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), input.timeoutMs);
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        authorization: `Bearer ${process.env.LLM_PROVIDER_API_KEY}`,
        "content-type": "application/json",
        "x-client-request-id": input.requestId,
      },
      body: JSON.stringify({
        model: input.model.id,
        instructions: input.system,
        input: input.messages.map((m) => ({ role: m.role, content: m.content })),
        max_output_tokens: input.maxOutputTokens,
        ...(input.model.reasoningEffort ? { reasoning: { effort: input.model.reasoningEffort } } : {}),
        store: false, // 대화 원문을 provider 쪽에 저장하지 않는다
      }),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new LlmError("timeout", null, "provider timeout");
    throw new LlmError("server", null, (e as Error).message);
  } finally {
    clearTimeout(timer);
  }

  const body = (await res.json().catch(() => ({}))) as ResponsesApiOutput;
  if (!res.ok) {
    const kind = res.status === 429 ? "rate_limited" : res.status >= 500 ? "server" : res.status === 401 || res.status === 403 ? "auth" : "bad_request";
    throw new LlmError(kind, res.status, body.error?.message?.slice(0, 200) ?? `HTTP ${res.status}`);
  }
  const text = (body.output ?? [])
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  if (!text) throw new LlmError("empty", res.status, `empty output (status=${body.status}, reason=${body.incomplete_details?.reason ?? "-"})`);
  return {
    text,
    inputTokens: body.usage?.input_tokens ?? 0,
    cachedInputTokens: body.usage?.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
    providerRequestId: res.headers.get("x-request-id") ?? body.id ?? null,
    truncated: body.status === "incomplete",
  };
}

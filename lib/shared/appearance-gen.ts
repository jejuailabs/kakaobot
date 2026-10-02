// AI 배경 생성 옵션과 prompt 합성 (docs/07). 서버가 같은 함수로 prompt 를 만든다 — 클라이언트가 보낸 완성 prompt 를 그대로 쓰지 않는다.

export const SCENES = ["mountain", "lake", "sea", "forest", "abstract"] as const;
export const PALETTES = ["teal", "lavender", "sunset"] as const;
export const SEASONS = ["any", "spring", "summer", "autumn", "winter"] as const;
export const CUSTOM_PROMPT_MAX = 300;

export type GenOptions = {
  theme: "light" | "dark";
  scene: (typeof SCENES)[number];
  palette: (typeof PALETTES)[number];
  season: (typeof SEASONS)[number];
  custom: string;
};

export type GenJobStatus = "queued" | "generating" | "processing" | "ready" | "failed";

const SCENE_TEXT: Record<GenOptions["scene"], string> = {
  mountain: "calm mountains with soft distant ridges",
  lake: "a still mountain lake with gentle reflections",
  sea: "a quiet open sea with a soft horizon",
  forest: "a misty forest edge with layered tree lines",
  abstract: "soft abstract flowing gradients like light through glass, no recognizable objects",
};
const PALETTE_TEXT: Record<GenOptions["palette"], string> = {
  teal: "teal and aqua tones",
  lavender: "teal and lavender tones",
  sunset: "warm sunset peach and soft violet tones",
};

export function isGenOptions(x: unknown): x is GenOptions {
  const o = x as Partial<GenOptions> | null;
  return (
    !!o &&
    (o.theme === "light" || o.theme === "dark") &&
    (SCENES as readonly string[]).includes(String(o.scene)) &&
    (PALETTES as readonly string[]).includes(String(o.palette)) &&
    (SEASONS as readonly string[]).includes(String(o.season)) &&
    typeof o.custom === "string" &&
    o.custom.length <= CUSTOM_PROMPT_MAX
  );
}

/** 기본 prompt (docs/07) + 선택 + 직접 입력. 안전 조건(글자·로고·UI·사람 없음, 중앙 저복잡도)은 항상 마지막에 붙인다. */
export function buildBackgroundPrompt(o: GenOptions): string {
  const parts = [
    `Realistic wide landscape photograph: ${SCENE_TEXT[o.scene]}, clear soft clouds, ${PALETTE_TEXT[o.palette]}.`,
    o.season !== "any" ? `Season: ${o.season}.` : "",
    o.theme === "dark" ? "Dusk or blue-hour lighting, deep but not black shadows." : "Bright airy morning light, gentle haze.",
    o.custom.trim() ? `Additional direction: ${o.custom.trim().replace(/\s+/g, " ")}` : "",
    "Used as a website background behind frosted glass panels: keep the center area low in visual complexity so text stays readable, no strong focal object in the middle.",
    "No text, no letters, no logos, no watermarks, no user interface, no people, no animals.",
  ];
  return parts.filter(Boolean).join(" ");
}

export type GenJobView = { id: string; status: GenJobStatus; error: string | null; assetId: string | null; costMicros: number; label: string; theme: "light" | "dark"; createdAt: string };

/** 운영자 화면에 내려주는 AI 생성 상태. 이미지 비용은 대화 비용과 별도 집계. */
export type GenerationInfo = { configured: boolean; model: string; quality: string; budgetMicros: number; monthCostMicros: number; monthCount: number; jobs: GenJobView[] };

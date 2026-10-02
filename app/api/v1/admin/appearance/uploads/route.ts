import { adminRoute, apiError } from "@/lib/server/api";
import { processUpload } from "@/lib/server/appearance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** multipart: file(이미지), theme(light|dark), label. 서버가 형식 재검증·재인코딩·EXIF 제거 후 private draft 로 저장. */
export const POST = adminRoute(
  "appearance.manage",
  async ({ req, user }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const theme = form?.get("theme");
    const label = String(form?.get("label") ?? "");
    if (!(file instanceof Blob) || (theme !== "light" && theme !== "dark")) throw apiError(400, "validation", "errors.validation");
    const buf = Buffer.from(await file.arrayBuffer());
    return { asset: await processUpload(user, buf, theme, label) };
  },
  { mutation: true },
);

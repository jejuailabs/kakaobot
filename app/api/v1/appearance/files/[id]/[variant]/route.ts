import { NextResponse, type NextRequest } from "next/server";
import { readAssetFile } from "@/lib/server/appearance";
import { getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/shared/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 배경 이미지 제공. 적용된 적 있는 배경은 공개(불변 캐시), draft 는 배경 관리 권한이 있는 운영자만.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await ctx.params;
  const file = await readAssetFile(id, variant);
  if (!file) return new NextResponse("not found", { status: 404 });
  if (!file.published) {
    const user = await getSessionUser();
    if (!user || !can(user.roles, "appearance.manage")) return new NextResponse("not found", { status: 404 });
    return new NextResponse(new Uint8Array(file.data), { headers: { "content-type": "image/webp", "cache-control": "private, no-store" } });
  }
  return new NextResponse(new Uint8Array(file.data), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
}

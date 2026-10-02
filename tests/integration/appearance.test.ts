import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 운영 배경(siteAppearance/current)을 건드리지 않도록 테스트 전용 사이트 문서를 쓴다.
const SITE = `test_${Date.now().toString(36)}`;
process.env.APPEARANCE_SITE_DOC = SITE;

const actor = { uid: "test-designer", roles: ["designer"] };
const created: string[] = [];

async function img(width: number, height: number, withExif = false) {
  const base = sharp({ create: { width, height, channels: 3, background: { r: 40, g: 90, b: 130 } } }).composite([
    { input: Buffer.from(`<svg width="${width}" height="${height}"><rect x="0" y="${height * 0.6}" width="${width}" height="${height * 0.4}" fill="#4a7f9b"/></svg>`), top: 0, left: 0 },
  ]);
  return (withExif ? base.withExifMerge({ IFD0: { Copyright: "secret-owner", Artist: "gps-person" } }) : base).jpeg().toBuffer();
}

let mod: typeof import("@/lib/server/appearance");
let db: ReturnType<(typeof import("@/lib/server/firebase-admin"))["adminDb"]>;

beforeAll(async () => {
  mod = await import("@/lib/server/appearance");
  db = (await import("@/lib/server/firebase-admin")).adminDb();
});

afterAll(async () => {
  for (const id of created) {
    await db.collection("backgroundAssets").doc(id).delete();
    for (const v of ["desktop", "mobile", "thumb"]) await db.collection("backgroundAssetFiles").doc(`${id}_${v}`).delete();
  }
  const versions = await db.collection("backgroundVersions").where("site", "==", SITE).get();
  await Promise.all(versions.docs.map((d) => d.ref.delete()));
  await db.collection("siteAppearance").doc(SITE).delete();
  const audits = await db.collection("auditLogs").where("actorUid", "==", actor.uid).get();
  await Promise.all(audits.docs.map((d) => d.ref.delete()));
});

describe("background appearance (real Firestore, isolated site doc)", () => {
  it("SVG·작은 이미지·손상 파일은 거절", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(mod.processUpload(actor, svg, "dark", "svg")).rejects.toMatchObject({ code: "validation", status: 415 });
    await expect(mod.processUpload(actor, await img(1200, 800), "dark", "small")).rejects.toMatchObject({ status: 422 });
    await expect(mod.processUpload(actor, Buffer.from("not an image at all"), "dark", "junk")).rejects.toMatchObject({ status: 415 });
  });

  it("업로드: EXIF 제거·크기 목표 내 webp 3종·draft 는 비공개", async () => {
    const src = await img(2800, 1600, true);
    expect((await sharp(src).metadata()).exif).toBeDefined();
    const { id } = await mod.processUpload(actor, src, "dark", "exif-test");
    created.push(id);
    const desktop = await mod.readAssetFile(id, "desktop");
    const mobile = await mod.readAssetFile(id, "mobile");
    expect(desktop?.published).toBe(false);
    const dm = await sharp(desktop!.data).metadata();
    expect(dm.format).toBe("webp");
    expect(dm.width).toBe(2560);
    expect(dm.exif).toBeUndefined();
    expect(desktop!.data.length).toBeLessThanOrEqual(700 * 1024);
    expect(mobile!.data.length).toBeLessThanOrEqual(350 * 1024);
    // 9:16 crop 폭(1600×9/16=900)보다 키우지 않는다 (흐림 방지), 최대 1080
    expect((await sharp(mobile!.data).metadata()).width).toBe(Math.min(1080, Math.round((1600 * 9) / 16)));
  });

  it("적용 → 버전 충돌 409 → 두 번째 적용 → 복원, 사용 중 삭제 거절", async () => {
    const a = created[0];
    const { id: b } = await mod.processUpload(actor, await img(2000, 1200), "dark", "second");
    created.push(b);
    const settings = { overlay: 0.2, blur: 2, brightness: 1, scope: "all" as const };

    await mod.publishAsset(actor, a, "dark", settings, 0, "첫 적용");
    expect((await mod.getActiveAppearanceUncached()).dark.desktopUrl).toContain(a);
    await expect(mod.publishAsset(actor, b, "dark", settings, 0, "늦은 적용")).rejects.toMatchObject({ code: "conflict" });

    await mod.publishAsset(actor, b, "dark", settings, 1, "두 번째 적용");
    let list = await mod.listAppearance();
    expect(list.assets.find((x) => x.id === a)?.state).toBe("previous");
    expect(list.assets.find((x) => x.id === b)?.state).toBe("active");
    expect((await mod.readAssetFile(a, "desktop"))?.published).toBe(true);

    await expect(mod.deleteAsset(actor, b)).rejects.toMatchObject({ code: "invalid_state" });

    await mod.rollbackTo(actor, a, 2, "이전 배경으로");
    list = await mod.listAppearance();
    expect(list.site.version).toBe(3);
    expect(list.site.activeDark).toBe(a);
    expect((await mod.getActiveAppearanceUncached()).dark.blurPx).toBe(2);

    await mod.deleteAsset(actor, b); // 이제 사용 중이 아님
    expect(await mod.readAssetFile(b, "desktop")).toBeNull();
  });
});

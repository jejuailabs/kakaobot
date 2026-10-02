import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import sharp, { type Sharp } from "sharp";
import { DEFAULT_APPEARANCE, type AppearanceManifest, type BackgroundVariant } from "@/lib/shared/appearance";
import { apiError } from "./api";
import { adminDb } from "./firebase-admin";

// Liquid Glass 배경 관리 (docs/02, docs/07).
// Firebase Storage 미사용(프로젝트에 버킷 없음, 신규 버킷은 Blaze 필요) → 재인코딩된 webp 를 Firestore Bytes 로 저장하고 /api/v1/appearance/files 로 제공.
// 크기 목표: desktop ≤700KB, mobile ≤350KB, thumb ≤60KB → 문서 한도(1MiB) 안.

const db = () => adminDb();
export const APPEARANCE_TAG = "appearance";
const MAX_INPUT_BYTES = 4 * 1024 * 1024; // 브라우저에서 줄여서 보낸다 (Vercel 요청 본문 한도 4.5MB)
const MIN_WIDTH = 1600;
const KEEP_VERSIONS = 20;
/** 사이트 설정 문서 ID. 통합 테스트는 별도 ID 를 써서 운영 배경을 건드리지 않는다. */
const SITE = () => process.env.APPEARANCE_SITE_DOC ?? "current";

export type Theme = "light" | "dark";
export type AppearanceSettings = { overlay: number; blur: number; brightness: number; scope: "all" | "dashboard" | "landing" };

type Actor = { uid: string; roles: string[] };

/** 매직 바이트로 판별 (확장자·Content-Type 을 믿지 않는다). SVG·실행 파일 차단. */
export function sniffImage(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

async function encodeUnder(img: Sharp, maxBytes: number): Promise<Buffer> {
  for (const quality of [82, 74, 66, 58, 50, 42]) {
    const out = await img.clone().webp({ quality, effort: 5 }).toBuffer();
    if (out.length <= maxBytes) return out;
  }
  throw apiError(422, "validation", "admin.appearance.tooComplex");
}

/** 업로드 처리: 검증 → EXIF 방향 반영 후 메타데이터 제거 → desktop/mobile/thumb 재인코딩 → private draft */
export async function processUpload(actor: Actor, buf: Buffer, theme: Theme, label: string) {
  if (buf.length > MAX_INPUT_BYTES) throw apiError(413, "validation", "admin.appearance.tooLarge");
  if (!sniffImage(buf)) throw apiError(415, "validation", "admin.appearance.badType");
  const base = sharp(buf, { failOn: "error", limitInputPixels: 60_000_000 }).rotate(); // rotate(): EXIF 방향 적용, 출력에 메타데이터는 기본 미포함
  const meta = await base.metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  if (width < MIN_WIDTH) throw apiError(422, "validation", "admin.appearance.tooSmall");

  const desktop = await encodeUnder(base.clone().resize({ width: 2560, withoutEnlargement: true }), 700 * 1024);
  // 모바일: 초점 40% 50% 기준 9:16
  const cropW = Math.min(width, Math.round((height * 9) / 16));
  const left = Math.max(0, Math.min(width - cropW, Math.round(width * 0.4 - cropW / 2)));
  const mobile = await encodeUnder(base.clone().extract({ left, top: 0, width: cropW, height }).resize({ width: 1080, withoutEnlargement: true }), 350 * 1024);
  const thumb = await encodeUnder(base.clone().resize({ width: 480 }), 60 * 1024);

  // 품질 검사용: 가운데 영역 평균 밝기 (자동 적용 시 대비 검사 기준)
  const stats = await sharp(desktop).resize(64).greyscale().stats();
  const luminance = Math.round(stats.channels[0].mean);

  const ref = db().collection("backgroundAssets").doc();
  const files = db().collection("backgroundAssetFiles");
  const batch = db().batch();
  batch.set(files.doc(`${ref.id}_desktop`), { assetId: ref.id, variant: "desktop", data: desktop, bytes: desktop.length });
  batch.set(files.doc(`${ref.id}_mobile`), { assetId: ref.id, variant: "mobile", data: mobile, bytes: mobile.length });
  batch.set(files.doc(`${ref.id}_thumb`), { assetId: ref.id, variant: "thumb", data: thumb, bytes: thumb.length });
  batch.set(ref, {
    id: ref.id,
    source: "upload",
    label: label.slice(0, 60) || "upload",
    theme,
    state: "draft",
    width: Math.min(2560, width),
    sizeKb: Math.round(desktop.length / 1024),
    luminance,
    createdBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(db().collection("auditLogs").doc(), { actorUid: actor.uid, actorRole: actor.roles.join(","), workspaceId: null, action: "appearance.upload", targetId: ref.id, reason: label.slice(0, 60), at: FieldValue.serverTimestamp() });
  await batch.commit();
  return { id: ref.id };
}

export async function listAppearance() {
  const [assetDocs, versions, site] = await Promise.all([
    db().collection("backgroundAssets").limit(200).get(),
    db().collection("backgroundVersions").where("site", "==", SITE()).limit(200).get(),
    db().collection("siteAppearance").doc(SITE()).get(),
  ]);
  return {
    site: { version: (site.data()?.version as number | undefined) ?? 0, activeLight: site.data()?.activeLightAssetId ?? null, activeDark: site.data()?.activeDarkAssetId ?? null },
    assets: assetDocs.docs
      .filter((d) => !d.data().deletedAt)
      .map((d) => {
        const x = d.data();
        return { id: d.id, source: x.source as "upload" | "ai", label: x.label as string, theme: x.theme as Theme, state: x.state as "active" | "draft" | "previous", width: x.width as number, sizeKb: x.sizeKb as number, luminance: x.luminance as number, createdAt: (x.createdAt as Timestamp | undefined)?.toDate().toISOString() ?? new Date().toISOString() };
      }),
    versions: versions.docs
      .map((d) => ({ id: d.id, ...(d.data() as { assetId: string; theme: Theme; createdAt?: Timestamp }) }))
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      .slice(0, 40)
      .map(({ id, assetId, theme }) => ({ id, assetId, theme })),
  };
}

function variantFor(assetId: string, s: AppearanceSettings, theme: Theme): BackgroundVariant {
  const tint = theme === "dark" ? "6, 26, 42" : "234, 245, 250";
  return {
    versionId: assetId,
    desktopUrl: `/api/v1/appearance/files/${assetId}/desktop`,
    mobileUrl: `/api/v1/appearance/files/${assetId}/mobile`,
    overlay: `rgba(${tint}, ${Math.min(0.6, Math.max(0, s.overlay))})`,
    blurPx: Math.min(8, Math.max(0, Math.round(s.blur))),
    brightness: Math.min(1.2, Math.max(0.6, s.brightness)),
    focusDesktop: "50% 55%",
    focusMobile: "40% 50%",
  };
}

/**
 * 적용: siteAppearance 를 단일 transaction 으로 갱신 (expectedVersion 불일치 409).
 * 이전 active 는 previous 로. 실패하면 기존 배경이 그대로 유지된다.
 */
export async function publishAsset(actor: Actor, assetId: string, theme: Theme, settings: AppearanceSettings, expectedVersion: number, reason: string) {
  const siteRef = db().collection("siteAppearance").doc(SITE());
  const assetRef = db().collection("backgroundAssets").doc(assetId);
  await db().runTransaction(async (tx) => {
    const [site, asset] = await Promise.all([tx.get(siteRef), tx.get(assetRef)]);
    const version = (site.data()?.version as number | undefined) ?? 0;
    if (version !== expectedVersion) throw apiError(409, "conflict", "errors.conflict");
    if (!asset.exists || asset.data()?.deletedAt || asset.data()?.theme !== theme) throw apiError(404, "not_found");
    const prevAssetId = site.data()?.[theme === "dark" ? "activeDarkAssetId" : "activeLightAssetId"] as string | undefined;
    const versionRef = db().collection("backgroundVersions").doc();
    tx.set(versionRef, { site: SITE(), assetId, theme, scope: settings.scope, overlay: settings.overlay, blur: settings.blur, brightness: settings.brightness, previousVersionId: site.data()?.[theme === "dark" ? "activeDarkVersionId" : "activeLightVersionId"] ?? null, createdBy: actor.uid, createdAt: FieldValue.serverTimestamp() });
    tx.set(
      siteRef,
      {
        version: version + 1,
        [theme === "dark" ? "activeDarkAssetId" : "activeLightAssetId"]: assetId,
        [theme === "dark" ? "activeDarkVersionId" : "activeLightVersionId"]: versionRef.id,
        [theme]: variantFor(assetId, settings, theme),
        updatedBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.update(assetRef, { state: "active" });
    if (prevAssetId && prevAssetId !== assetId) tx.update(db().collection("backgroundAssets").doc(prevAssetId), { state: "previous" });
    tx.set(db().collection("auditLogs").doc(), { actorUid: actor.uid, actorRole: actor.roles.join(","), workspaceId: null, action: "appearance.publish", targetId: `${assetId} (${theme}) v${version + 1}`, reason, at: FieldValue.serverTimestamp() });
  });
  await pruneVersions();
}

/** 복원: 이전 배경을 마지막 설정으로 다시 적용 (새 버전으로 기록) */
export async function rollbackTo(actor: Actor, assetId: string, expectedVersion: number, reason: string) {
  const asset = await db().collection("backgroundAssets").doc(assetId).get();
  if (!asset.exists) throw apiError(404, "not_found");
  const last = await db().collection("backgroundVersions").where("assetId", "==", assetId).where("site", "==", SITE()).limit(20).get();
  const latest = last.docs.map((d) => d.data()).sort((a, b) => ((b.createdAt as Timestamp)?.toMillis() ?? 0) - ((a.createdAt as Timestamp)?.toMillis() ?? 0))[0];
  const settings: AppearanceSettings = latest ? { overlay: latest.overlay, blur: latest.blur, brightness: latest.brightness, scope: latest.scope } : { overlay: 0.16, blur: 0, brightness: 1, scope: "all" };
  await publishAsset(actor, assetId, asset.data()!.theme, settings, expectedVersion, `rollback: ${reason}`);
}

/** 사용 중(active) 배경은 삭제 거절 */
export async function deleteAsset(actor: Actor, assetId: string) {
  const ref = db().collection("backgroundAssets").doc(assetId);
  const site = (await db().collection("siteAppearance").doc(SITE()).get()).data();
  if (site?.activeLightAssetId === assetId || site?.activeDarkAssetId === assetId) throw apiError(409, "invalid_state", "admin.appearance.inUse");
  const snap = await ref.get();
  if (!snap.exists) throw apiError(404, "not_found");
  const batch = db().batch();
  batch.update(ref, { deletedAt: FieldValue.serverTimestamp(), state: "deleted" });
  for (const v of ["desktop", "mobile", "thumb"]) batch.delete(db().collection("backgroundAssetFiles").doc(`${assetId}_${v}`));
  batch.set(db().collection("auditLogs").doc(), { actorUid: actor.uid, actorRole: actor.roles.join(","), workspaceId: null, action: "appearance.delete", targetId: assetId, reason: "", at: FieldValue.serverTimestamp() });
  await batch.commit();
}

async function pruneVersions() {
  // 같은 사이트 문서의 버전만 정리 (복합 index 없이 메모리 정렬)
  const snap = await db().collection("backgroundVersions").where("site", "==", SITE()).limit(500).get();
  const site = (await db().collection("siteAppearance").doc(SITE()).get()).data();
  const keep = new Set([site?.activeLightVersionId, site?.activeDarkVersionId]);
  const sorted = [...snap.docs].sort((a, b) => ((b.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0) - ((a.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0));
  const old = sorted.slice(KEEP_VERSIONS).filter((d) => !keep.has(d.id));
  if (old.length) {
    const batch = db().batch();
    old.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function readAssetFile(assetId: string, variant: string) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(assetId) || !["desktop", "mobile", "thumb"].includes(variant)) return null;
  const [file, asset] = await Promise.all([db().collection("backgroundAssetFiles").doc(`${assetId}_${variant}`).get(), db().collection("backgroundAssets").doc(assetId).get()]);
  if (!file.exists || !asset.exists || asset.data()?.deletedAt) return null;
  return { data: Buffer.from(file.data()!.data as Uint8Array), published: asset.data()!.state !== "draft" };
}

/** 캐시 없이 현재 manifest 를 읽는다 (테스트·운영자 미리보기용) */
export async function getActiveAppearanceUncached(): Promise<AppearanceManifest> {
  try {
    const site = (await db().collection("siteAppearance").doc(SITE()).get()).data();
    if (!site) return DEFAULT_APPEARANCE;
    return { version: site.version ?? 0, light: (site.light as BackgroundVariant) ?? DEFAULT_APPEARANCE.light, dark: (site.dark as BackgroundVariant) ?? DEFAULT_APPEARANCE.dark };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** 고객 화면용 활성 manifest. 태그 캐시 → 적용/복원 시 즉시 무효화. 읽기 실패 시 내장 기본 배경. */
export const getActiveAppearance = unstable_cache(
  async (): Promise<AppearanceManifest> => {
    try {
      const site = (await db().collection("siteAppearance").doc(SITE()).get()).data();
      if (!site) return DEFAULT_APPEARANCE;
      return { version: site.version ?? 0, light: (site.light as BackgroundVariant) ?? DEFAULT_APPEARANCE.light, dark: (site.dark as BackgroundVariant) ?? DEFAULT_APPEARANCE.dark };
    } catch {
      return DEFAULT_APPEARANCE;
    }
  },
  ["site-appearance"],
  { tags: [APPEARANCE_TAG], revalidate: 600 },
);

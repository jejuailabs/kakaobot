import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import sharp, { type Sharp } from "sharp";
import { DEFAULT_APPEARANCE, type AppearanceManifest, type BackgroundVariant } from "@/lib/shared/appearance";
import { buildBackgroundPrompt, type GenerationInfo, type GenJobStatus, type GenJobView, type GenOptions } from "@/lib/shared/appearance-gen";
import { apiError } from "./api";
import { adminBucket, adminDb } from "./firebase-admin";
import { generateImage, IMAGE_MODEL, ImageGenError, imageCostMicros, isImageGenConfigured } from "./image-gen";

// Liquid Glass 배경 관리 (docs/02, docs/07).
// 재인코딩된 webp 를 Firebase Storage `backgrounds/{assetId}/{variant}.webp` 에 저장한다.
// draft 는 비공개(운영자만 /api/v1/appearance/files 로 미리보기), 적용하면 공개 객체로 바꿔 CDN 캐시 URL 로 제공한다.
// 크기 목표: desktop ≤700KB, mobile ≤350KB, thumb ≤60KB.

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
  const { id } = await storeAsset(actor, buf, theme, { source: "upload", label: label.slice(0, 60) || "upload" });
  return { id };
}

type AssetExtra = { source: "upload" | "ai"; label: string; jobId?: string; prompt?: string; model?: string; costMicros?: number };

/** 공통 처리: 검증 → 재인코딩 → Storage(비공개) → asset 문서 + 감사. 업로드와 AI 생성이 같은 검증·크기 목표를 거친다. */
async function storeAsset(actor: Actor, buf: Buffer, theme: Theme, extra: AssetExtra) {
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
  // 파일을 먼저 Storage 에 비공개로 올리고, 성공한 뒤에 asset 문서를 만든다
  await Promise.all(
    (
      [
        ["desktop", desktop],
        ["mobile", mobile],
        ["thumb", thumb],
      ] as const
    ).map(([variant, data]) =>
      adminBucket()
        .file(objectPath(ref.id, variant))
        .save(data, { resumable: false, contentType: "image/webp", metadata: { cacheControl: "private, max-age=0" } }),
    ),
  );
  const batch = db().batch();
  batch.set(ref, {
    id: ref.id,
    ...extra,
    theme,
    state: "draft",
    width: Math.min(2560, width),
    sizeKb: Math.round(desktop.length / 1024),
    luminance,
    createdBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(db().collection("auditLogs").doc(), { actorUid: actor.uid, actorRole: actor.roles.join(","), workspaceId: null, action: extra.source === "ai" ? "appearance.generated" : "appearance.upload", targetId: ref.id, reason: extra.label, at: FieldValue.serverTimestamp() });
  await batch.commit();
  return { id: ref.id };
}

// ---------------------------------------------------------------------------
// AI 배경 생성 job (docs/07): 동시에 1 job, 확정 실패(429/5xx)만 1 회 재시도, 결과 불명(timeout)은 재시도·재생성하지 않는다.
// 이미지 비용은 대화 비용과 별도(imageUsageMonthly)로 예약→정산한다.

const GEN_RESERVE_MICROS = 50_000; // $0.05 — low 실측 ≈ $0.005 의 10 배. 결과 불명이면 이 값을 비용으로 잡는다.
const GEN_STALE_MS = 5 * 60_000; // 함수가 중간에 죽어 lock 이 남은 경우 이 시간 뒤 불명 실패로 정리
const GEN_TIMEOUT_MS = 90_000;
const ACTIVE_STATUSES: GenJobStatus[] = ["queued", "generating", "processing"];

export function imageBudgetMicros() {
  const usd = Number(process.env.IMAGE_MONTHLY_BUDGET_USD ?? "5");
  return Math.round((Number.isFinite(usd) && usd >= 0 ? usd : 5) * 1_000_000);
}
const thisMonth = () => new Date().toISOString().slice(0, 7);
const genLockRef = () => db().collection("appearanceGenLocks").doc(SITE());
const usageRef = (month: string) => db().collection("imageUsageMonthly").doc(`${SITE()}_${month}`);
const jobRef = (id: string) => db().collection("backgroundJobs").doc(id);



function jobView(id: string, x: Record<string, unknown>): GenJobView {
  return {
    id,
    status: x.status as GenJobStatus,
    error: (x.error as string | null | undefined) ?? null,
    assetId: (x.assetId as string | null | undefined) ?? null,
    costMicros: (x.costMicros as number | undefined) ?? 0,
    label: (x.label as string | undefined) ?? "",
    theme: x.theme as Theme,
    createdAt: (x.createdAt as Timestamp | undefined)?.toDate().toISOString() ?? new Date().toISOString(),
  };
}

/**
 * 생성 요청. requestId(클라이언트 Idempotency-Key) 가 job ID 라서 같은 요청을 다시 보내도 job 은 하나다.
 * Image API 가 동기 응답이라 반환 시점에 job 은 ready 또는 failed.
 */
export async function generateBackground(actor: Actor, requestId: string, opts: GenOptions): Promise<GenJobView> {
  if (!isImageGenConfigured()) throw apiError(503, "not_configured", "errors.not_configured");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) throw apiError(400, "validation", "errors.validation");
  const ref = jobRef(requestId);
  const prompt = buildBackgroundPrompt(opts);
  const label = `AI · ${opts.scene} · ${opts.palette}`;
  const month = thisMonth();

  const existing = await db().runTransaction(async (tx) => {
    const [job, lock, usage] = await Promise.all([tx.get(ref), tx.get(genLockRef()), tx.get(usageRef(month))]);
    if (job.exists) return jobView(job.id, job.data()!);
    const activeId = lock.data()?.activeJobId as string | undefined;
    if (activeId) {
      const active = await tx.get(jobRef(activeId));
      const a = active.data();
      const since = (a?.startedAt as Timestamp | undefined)?.toMillis() ?? 0;
      if (a && ACTIVE_STATUSES.includes(a.status) && Date.now() - since < GEN_STALE_MS) throw apiError(409, "invalid_state", "admin.appearance.genBusy");
      if (a && ACTIVE_STATUSES.includes(a.status)) {
        // 함수가 중간에 종료된 job: 생성·과금 여부 불명 → 예약액을 비용으로 확정하고 다시 만들지 않는다
        const reserved = (a.reservedMicros as number | undefined) ?? GEN_RESERVE_MICROS;
        tx.update(active.ref, { status: "failed", error: "unknown", costMicros: reserved, finishedAt: FieldValue.serverTimestamp() });
        tx.set(usageRef((a.month as string | undefined) ?? month), { reservedMicros: FieldValue.increment(-reserved), costMicros: FieldValue.increment(reserved), unknown: FieldValue.increment(1) }, { merge: true });
      }
    }
    const u = usage.data() ?? {};
    if (((u.costMicros as number | undefined) ?? 0) + ((u.reservedMicros as number | undefined) ?? 0) + GEN_RESERVE_MICROS > imageBudgetMicros()) throw apiError(429, "limit", "admin.appearance.genBudget");
    tx.create(ref, { site: SITE(), status: "generating", theme: opts.theme, options: opts, prompt, label, model: IMAGE_MODEL.id, quality: IMAGE_MODEL.quality, size: IMAGE_MODEL.size, month, reservedMicros: GEN_RESERVE_MICROS, attempts: 0, createdBy: actor.uid, createdAt: FieldValue.serverTimestamp(), startedAt: Timestamp.now() });
    tx.set(genLockRef(), { activeJobId: requestId, at: FieldValue.serverTimestamp() });
    tx.set(usageRef(month), { site: SITE(), month, reservedMicros: FieldValue.increment(GEN_RESERVE_MICROS) }, { merge: true });
    tx.set(db().collection("auditLogs").doc(), { actorUid: actor.uid, actorRole: actor.roles.join(","), workspaceId: null, action: "appearance.generate", targetId: requestId, reason: `${opts.theme} ${opts.scene}/${opts.palette}/${opts.season}${opts.custom.trim() ? " +custom" : ""}`, at: FieldValue.serverTimestamp() });
    return null;
  });
  if (existing) return existing;

  /** 종료 처리: job 상태 + 예약 정산 + lock 해제를 한 transaction 으로 */
  const finish = async (patch: Record<string, unknown>, chargedMicros: number, counted: boolean) => {
    await db().runTransaction(async (tx) => {
      const lock = await tx.get(genLockRef());
      tx.update(ref, { ...patch, costMicros: chargedMicros, finishedAt: FieldValue.serverTimestamp() });
      tx.set(
        usageRef(month),
        {
          reservedMicros: FieldValue.increment(-GEN_RESERVE_MICROS),
          costMicros: FieldValue.increment(chargedMicros),
          ...(counted ? { count: FieldValue.increment(1) } : {}),
          ...(patch.error === "unknown" ? { unknown: FieldValue.increment(1) } : {}),
        },
        { merge: true },
      );
      if (lock.data()?.activeJobId === requestId) tx.delete(genLockRef());
    });
    return jobView(requestId, (await ref.get()).data() ?? {});
  };

  let result: Awaited<ReturnType<typeof generateImage>> | null = null;
  for (let attempt = 1; attempt <= 2 && !result; attempt++) {
    try {
      await ref.update({ attempts: attempt });
      result = await generateImage({ prompt, requestId: `${requestId}-${attempt}`, timeoutMs: GEN_TIMEOUT_MS });
    } catch (e) {
      const err = e instanceof ImageGenError ? e : new ImageGenError("server", null, String(e).slice(0, 200));
      if (err.unknown) return finish({ status: "failed", error: "unknown", errorDetail: err.message }, GEN_RESERVE_MICROS, false);
      if (!err.retryable || attempt === 2) return finish({ status: "failed", error: err.kind, errorDetail: err.message }, 0, false);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  const r = result!;
  const cost = imageCostMicros(r.inputTokens, r.outputTokens);
  await ref.update({ status: "processing", providerRequestId: r.providerRequestId, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
  try {
    const asset = await storeAsset(actor, r.data, opts.theme, { source: "ai", label, jobId: requestId, prompt, model: IMAGE_MODEL.id, costMicros: cost });
    return await finish({ status: "ready", assetId: asset.id, error: null }, cost, true);
  } catch (e) {
    // 생성은 됐고 비용도 발생 — 비용은 정산하되 재생성하지 않는다
    return finish({ status: "failed", error: "processing", errorDetail: String((e as { messageKey?: string }).messageKey ?? e).slice(0, 200) }, cost, true);
  }
}

export async function generationStatus(): Promise<GenerationInfo> {
  const [jobs, usage] = await Promise.all([db().collection("backgroundJobs").where("site", "==", SITE()).limit(100).get(), usageRef(thisMonth()).get()]);
  const u = usage.data() ?? {};
  return {
    configured: isImageGenConfigured(),
    model: IMAGE_MODEL.id,
    quality: IMAGE_MODEL.quality,
    budgetMicros: imageBudgetMicros(),
    monthCostMicros: (u.costMicros as number | undefined) ?? 0,
    monthCount: (u.count as number | undefined) ?? 0,
    jobs: jobs.docs
      .map((d) => jobView(d.id, d.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6),
  };
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

const VARIANTS = ["desktop", "mobile", "thumb"] as const;
function objectPath(assetId: string, variant: (typeof VARIANTS)[number]) {
  return `backgrounds/${assetId}/${variant}.webp`;
}
function publicUrl(assetId: string, variant: (typeof VARIANTS)[number]) {
  return `https://storage.googleapis.com/${adminBucket().name}/${objectPath(assetId, variant)}`;
}

/** 적용 시 공개 객체로 전환 + 불변 캐시 (asset ID 마다 내용이 고정이라 immutable) */
async function makeAssetPublic(assetId: string) {
  await Promise.all(
    VARIANTS.map(async (v) => {
      const f = adminBucket().file(objectPath(assetId, v));
      await f.setMetadata({ cacheControl: "public, max-age=31536000, immutable" });
      await f.makePublic();
    }),
  );
}

function variantFor(assetId: string, s: AppearanceSettings, theme: Theme): BackgroundVariant {
  const tint = theme === "dark" ? "6, 26, 42" : "234, 245, 250";
  return {
    versionId: assetId,
    desktopUrl: publicUrl(assetId, "desktop"),
    mobileUrl: publicUrl(assetId, "mobile"),
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
  const pre = await assetRef.get();
  if (!pre.exists || pre.data()?.deletedAt || pre.data()?.theme !== theme) throw apiError(404, "not_found");
  // 공개 전환을 transaction 전에 끝낸다. transaction 이 실패해도(예: 409) 고객 화면은 바뀌지 않는다.
  await makeAssetPublic(assetId);
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
  batch.set(db().collection("auditLogs").doc(), { actorUid: actor.uid, actorRole: actor.roles.join(","), workspaceId: null, action: "appearance.delete", targetId: assetId, reason: "", at: FieldValue.serverTimestamp() });
  await batch.commit();
  await Promise.all(VARIANTS.map((v) => adminBucket().file(objectPath(assetId, v)).delete({ ignoreNotFound: true })));
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
  if (!/^[A-Za-z0-9]{10,40}$/.test(assetId) || !(VARIANTS as readonly string[]).includes(variant)) return null;
  const asset = await db().collection("backgroundAssets").doc(assetId).get();
  if (!asset.exists || asset.data()?.deletedAt) return null;
  try {
    const [data] = await adminBucket().file(objectPath(assetId, variant as (typeof VARIANTS)[number])).download();
    return { data, published: asset.data()!.state !== "draft" };
  } catch {
    return null;
  }
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

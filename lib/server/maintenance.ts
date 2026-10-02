import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { processJob } from "./runtime";

const db = () => adminDb();

/**
 * 처리되지 못한 job 재처리: 1분 넘게 queued 이거나 lease 가 만료된 processing.
 * (ingress 직후 after() 처리가 실패·중단된 경우 대비. relay outbox poll 마다 소량씩 호출)
 * processJob 의 lease claim 덕분에 여러 곳에서 동시에 불려도 한 번만 처리된다.
 */
export async function sweepStaleJobs(limit = 3): Promise<number> {
  const now = Date.now();
  const [queued, processing] = await Promise.all([
    db().collection("jobs").where("state", "==", "queued").limit(20).get(),
    db().collection("jobs").where("state", "==", "processing").limit(20).get(),
  ]);
  const stale = [
    ...queued.docs.filter((d) => ((d.data().createdAt as Timestamp | undefined)?.toMillis() ?? now) < now - 60_000),
    ...processing.docs.filter((d) => ((d.data().leaseUntil as Timestamp | undefined)?.toMillis() ?? now) < now),
  ].slice(0, limit);
  for (const d of stale) await processJob(d.id);
  return stale.length;
}

/**
 * 만료 데이터 수동 삭제 (TTL 은 즉시 삭제를 보장하지 않으므로 별도로 지운다, docs/05).
 * 대화 로그는 방별 보관기간으로 정해진 expiresAt 기준.
 */
export async function cleanupExpired(): Promise<Record<string, number>> {
  const now = Timestamp.now();
  const result: Record<string, number> = {};
  for (const col of ["conversationLogs", "events", "gatewayNonces", "rateCounters", "wizardDrafts", "idempotencyKeys"]) {
    let removed = 0;
    for (let round = 0; round < 5; round++) {
      const snap = await db().collection(col).where("expiresAt", "<", now).limit(400).get();
      if (snap.empty) break;
      const batch = db().batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      removed += snap.size;
    }
    result[col] = removed;
  }
  // 사용됐거나 만료된 지 하루 지난 연결 코드
  const tokens = await db().collection("pairingTokens").where("expiresAt", "<", Timestamp.fromMillis(Date.now() - 86_400_000)).limit(400).get();
  if (!tokens.empty) {
    const batch = db().batch();
    tokens.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  result.pairingTokens = tokens.size;
  return result;
}

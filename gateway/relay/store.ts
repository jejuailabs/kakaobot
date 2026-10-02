// relay 로컬 durable 저장소 (SQLite, node:sqlite — 네이티브 의존성 없음).
// inbox: Iris 에서 받은 이벤트를 ingress 로 보내기 전에 먼저 기록 (재시작해도 유실 없음, 같은 eventId 로 재시도)
// journal: 송신 전에 먼저 기록 → Iris 송신 → 결과. 송신 중 크래시는 재시작 시 unknown 으로 보고하고 재전송하지 않는다.
import { DatabaseSync } from "node:sqlite";

export type InboxRow = { event_id: string; payload: string; attempts: number; next_at: number };
export type JournalState = "sending" | "sent" | "failed" | "unknown";

const BACKOFF_MS = [1000, 2000, 4000, 8000, 30000];

export class RelayStore {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS inbox (
        event_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_error TEXT
      );
      CREATE TABLE IF NOT EXISTS journal (
        delivery_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        text_hash TEXT NOT NULL,
        state TEXT NOT NULL,
        acked INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS inbox_due ON inbox(state, next_at);
    `);
  }

  /** 같은 eventId 는 한 번만 저장 (Iris 중복 콜백 대비) */
  enqueue(eventId: string, payload: unknown): boolean {
    const r = this.db.prepare("INSERT OR IGNORE INTO inbox (event_id, payload, next_at, created_at) VALUES (?, ?, ?, ?)").run(eventId, JSON.stringify(payload), Date.now(), Date.now());
    return Number(r.changes) > 0;
  }

  due(limit = 20): InboxRow[] {
    return this.db.prepare("SELECT event_id, payload, attempts, next_at FROM inbox WHERE state = 'pending' AND next_at <= ? ORDER BY created_at LIMIT ?").all(Date.now(), limit) as InboxRow[];
  }

  markSent(eventId: string) {
    this.db.prepare("UPDATE inbox SET state = 'sent', last_error = NULL WHERE event_id = ?").run(eventId);
  }

  /** 1/2/4/8/30초 backoff + jitter, 이후 30초 간격으로 계속 재시도 (같은 eventId) */
  markRetry(eventId: string, attempts: number, error: string) {
    const base = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
    const next = Date.now() + base + Math.floor(Math.random() * 300);
    this.db.prepare("UPDATE inbox SET attempts = ?, next_at = ?, last_error = ? WHERE event_id = ?").run(attempts + 1, next, error.slice(0, 200), eventId);
  }

  /** 4xx(검증 실패 등)는 재시도해도 같으므로 dead 로 보관 */
  markDead(eventId: string, error: string) {
    this.db.prepare("UPDATE inbox SET state = 'dead', last_error = ? WHERE event_id = ?").run(error.slice(0, 200), eventId);
  }

  journalBegin(deliveryId: string, roomId: string, textHash: string): boolean {
    const r = this.db.prepare("INSERT OR IGNORE INTO journal (delivery_id, room_id, text_hash, state, created_at, updated_at) VALUES (?, ?, ?, 'sending', ?, ?)").run(deliveryId, roomId, textHash, Date.now(), Date.now());
    return Number(r.changes) > 0; // 이미 기록된 delivery 는 다시 보내지 않는다
  }

  journalSet(deliveryId: string, state: JournalState) {
    this.db.prepare("UPDATE journal SET state = ?, updated_at = ? WHERE delivery_id = ?").run(state, Date.now(), deliveryId);
  }

  journalAcked(deliveryId: string) {
    this.db.prepare("UPDATE journal SET acked = 1 WHERE delivery_id = ?").run(deliveryId);
  }

  /** 재시작 시: 송신 중이던 건은 성공 여부 불명 → unknown (재전송 금지) */
  recoverInterruptedSends(): string[] {
    const rows = this.db.prepare("SELECT delivery_id FROM journal WHERE state = 'sending'").all() as { delivery_id: string }[];
    for (const r of rows) this.journalSet(r.delivery_id, "unknown");
    return rows.map((r) => r.delivery_id);
  }

  unackedResults(): { delivery_id: string; state: JournalState }[] {
    return this.db.prepare("SELECT delivery_id, state FROM journal WHERE acked = 0 AND state != 'sending'").all() as { delivery_id: string; state: JournalState }[];
  }

  /** 자기 메시지 판별: 최근 2분 내 같은 방에 보낸 같은 내용이면 self */
  recentlySent(roomId: string, textHash: string): boolean {
    const row = this.db.prepare("SELECT 1 FROM journal WHERE room_id = ? AND text_hash = ? AND updated_at > ? LIMIT 1").get(roomId, textHash, Date.now() - 120_000);
    return Boolean(row);
  }

  stats() {
    const q = (sql: string) => (this.db.prepare(sql).get() as { c: number }).c;
    return {
      inboxPending: q("SELECT count(*) c FROM inbox WHERE state = 'pending'"),
      inboxDead: q("SELECT count(*) c FROM inbox WHERE state = 'dead'"),
      journalUnknown: q("SELECT count(*) c FROM journal WHERE state = 'unknown'"),
    };
  }

  close() {
    this.db.close();
  }
}

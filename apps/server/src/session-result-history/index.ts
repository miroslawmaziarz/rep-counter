import { DatabaseSync } from "node:sqlite";

/** What is kept about a Session. */
export type SessionResult = {
  sessionId: string;
  reps: number;
  durationSec: number;
  /** ISO 8601 with an offset; stored and returned in UTC (`…Z`). */
  performedAt: string;
};

/**
 * What saving did, with the Session Result as stored:
 * - `saved`: the first save of this `sessionId` for the Patient
 * - `resent`: an identical Resend; nothing changed
 * - `conflict`: a Resend with different values; the original is kept
 */
export type SaveOutcome = {
  outcome: "saved" | "resent" | "conflict";
  sessionResult: SessionResult;
};

/** Each Patient's Session Results, saved once per `(Patient, sessionId)`. */
export type SessionResultHistory = {
  save(patientId: string, sessionResult: SessionResult): SaveOutcome;
  /** The Patient's Session Results, newest `performedAt` first, ties in save order. */
  list(patientId: string): SessionResult[];
  close(): void;
};

/**
 * Opens the history in a `node:sqlite` database, a file path or
 * `:memory:`, creating its table if needed. The Resend rule (ADR 0002) is
 * enforced by the table's `(patient_id, session_id)` key.
 */
export function openSessionResultHistory(
  databasePath: string,
): SessionResultHistory {
  const db = new DatabaseSync(databasePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_results (
      patient_id   TEXT    NOT NULL,
      session_id   TEXT    NOT NULL,
      reps         INTEGER NOT NULL,
      duration_sec REAL    NOT NULL,
      performed_at TEXT    NOT NULL,
      PRIMARY KEY (patient_id, session_id)
    )
  `);

  const insert = db.prepare(`
    INSERT INTO session_results
      (patient_id, session_id, reps, duration_sec, performed_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);
  const selectOne = db.prepare(`
    SELECT session_id, reps, duration_sec, performed_at
    FROM session_results
    WHERE patient_id = ? AND session_id = ?
  `);
  const selectAll = db.prepare(`
    SELECT session_id, reps, duration_sec, performed_at
    FROM session_results
    WHERE patient_id = ?
    ORDER BY performed_at DESC, rowid ASC
  `);

  return {
    save(patientId, received) {
      const sessionResult = {
        ...received,
        performedAt: new Date(received.performedAt).toISOString(),
      };
      const { changes } = insert.run(
        patientId,
        sessionResult.sessionId,
        sessionResult.reps,
        sessionResult.durationSec,
        sessionResult.performedAt,
      );
      const stored = toSessionResult(
        selectOne.get(patientId, sessionResult.sessionId)!,
      );
      if (changes === 1) return { outcome: "saved", sessionResult: stored };
      return {
        outcome: sameValues(stored, sessionResult) ? "resent" : "conflict",
        sessionResult: stored,
      };
    },
    list(patientId) {
      return selectAll.all(patientId).map(toSessionResult);
    },
    close() {
      db.close();
    },
  };
}

function sameValues(a: SessionResult, b: SessionResult): boolean {
  return (
    a.reps === b.reps &&
    a.durationSec === b.durationSec &&
    a.performedAt === b.performedAt
  );
}

function toSessionResult(row: Record<string, unknown>): SessionResult {
  return {
    sessionId: row.session_id as string,
    reps: row.reps as number,
    durationSec: row.duration_sec as number,
    performedAt: row.performed_at as string,
  };
}

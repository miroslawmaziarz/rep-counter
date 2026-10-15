import type { Patient, SessionResult } from "@rep-counter/core";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** `node:sqlite`'s name for a database that lives only in memory. */
const IN_MEMORY = ":memory:";

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
  save(patient: Patient, sessionResult: SessionResult): SaveOutcome;
  /** The Patient's Session Results, newest `performedAt` first, ties in save order. */
  list(patient: Patient): SessionResult[];
  close(): void;
};

/**
 * Opens the history in a `node:sqlite` database, a file path or
 * `:memory:`, creating the file's directories and its table if needed. The
 * Resend rule (ADR 0002) is enforced by the table's `(patient_id,
 * session_id)` key.
 */
export function openSessionResultHistory(
  databasePath: string,
): SessionResultHistory {
  if (databasePath !== IN_MEMORY) {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
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
    save(patient, sessionResult) {
      const { changes } = insert.run(
        patient.id,
        sessionResult.sessionId,
        sessionResult.reps,
        sessionResult.durationSec,
        sessionResult.performedAt,
      );
      const stored = toSessionResult(
        selectOne.get(patient.id, sessionResult.sessionId)!,
      );
      if (changes === 1) return { outcome: "saved", sessionResult: stored };
      return {
        outcome: sameValues(stored, sessionResult) ? "resent" : "conflict",
        sessionResult: stored,
      };
    },
    list(patient) {
      return selectAll.all(patient.id).map(toSessionResult);
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

/**
 * A stored row as a Session Result. Only parsed Session Results are saved,
 * so a row is one already.
 */
function toSessionResult(row: Record<string, unknown>): SessionResult {
  return {
    sessionId: row.session_id as string,
    reps: row.reps as number,
    durationSec: row.duration_sec as number,
    performedAt: row.performed_at as string,
  } as SessionResult;
}

import { DatabaseSync } from "node:sqlite";

/** What is kept about a Session. */
export type SessionResult = {
  sessionId: string;
  reps: number;
  durationSec: number;
  performedAt: string;
};

export type SaveOutcome = {
  outcome: "saved" | "resent" | "conflict";
  sessionResult: SessionResult;
};

export type SessionResultHistory = {
  save(patientId: string, sessionResult: SessionResult): SaveOutcome;
  list(patientId: string): SessionResult[];
  close(): void;
};

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
  `);

  return {
    save(patientId, sessionResult) {
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

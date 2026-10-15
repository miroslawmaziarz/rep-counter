import { DatabaseSync } from "node:sqlite";

/** What is kept about a Session. */
export type SessionResult = {
  sessionId: string;
  reps: number;
  durationSec: number;
  performedAt: string;
};

export type SaveOutcome = {
  outcome: "saved";
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
      performed_at TEXT    NOT NULL
    )
  `);

  const insert = db.prepare(`
    INSERT INTO session_results
      (patient_id, session_id, reps, duration_sec, performed_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const selectAll = db.prepare(`
    SELECT session_id, reps, duration_sec, performed_at
    FROM session_results
    WHERE patient_id = ?
  `);

  return {
    save(patientId, sessionResult) {
      insert.run(
        patientId,
        sessionResult.sessionId,
        sessionResult.reps,
        sessionResult.durationSec,
        sessionResult.performedAt,
      );
      return { outcome: "saved", sessionResult };
    },
    list(patientId) {
      return selectAll.all(patientId).map(toSessionResult);
    },
    close() {
      db.close();
    },
  };
}

function toSessionResult(row: Record<string, unknown>): SessionResult {
  return {
    sessionId: row.session_id as string,
    reps: row.reps as number,
    durationSec: row.duration_sec as number,
    performedAt: row.performed_at as string,
  };
}

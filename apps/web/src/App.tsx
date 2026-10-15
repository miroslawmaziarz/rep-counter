import {
  parseRecording,
  patients,
  sessionResultOf,
  type Recording,
  type SessionResult,
} from "@rep-counter/core";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  sessionResultClient,
  type ListedSessionResults,
  type SaveOutcome,
  type SessionResultClient,
} from "./session-result-client";

/**
 * The Session made from the picked Recording. It keeps the client of the
 * Patient it was picked for, so it can only ever be saved to their history.
 */
type Session = {
  /** The pick it was made from; see `shownPick`. */
  pick: symbol;
  /** The id of the Patient it was picked for; see `chosenPatientId`. */
  patientId: string;
  client: SessionResultClient;
  recording: Recording;
  sessionResult: SessionResult;
  /** Whether a save is in flight. */
  sending: boolean;
  /** How the last save ended; none yet while the first is in flight. */
  outcome?: SaveOutcome;
};

/** Stands for a file whose text does not parse as JSON. */
const NOT_JSON = Symbol("not JSON");

/** A picked file that is not a Recording, and why; nothing is sent. */
type Refusal = { refused: string; problems: string[] };

export function App() {
  const [patient, setPatient] = useState(patients[0]!);
  // One client per Patient token, so nothing is sent under another Patient.
  const client = useMemo(
    () => sessionResultClient(patient.token),
    [patient.token],
  );
  // Kept with the token it was listed for, so another Patient's history
  // reads as still loading rather than as theirs.
  const [history, setHistory] = useState<{
    token: string;
    listed: ListedSessionResults;
  }>();
  // Bumped after a save, to list the history again.
  const [historyVersion, setHistoryVersion] = useState(0);
  const [session, setSession] = useState<Session>();
  const [refusal, setRefusal] = useState<Refusal>();
  // Replaced whenever the shown Session is discarded, so a file read or a
  // save's answer that arrives for an older pick is dropped.
  const shownPick = useRef(Symbol("pick"));
  // The Patient chosen now, so a save answered for an older pick of the same
  // Patient still lists their history again, and one for another does not.
  const chosenPatientId = useRef(patient.id);

  useEffect(() => {
    let current = true;
    void client.list().then((listed) => {
      if (current) setHistory({ token: patient.token, listed });
    });
    return () => {
      current = false;
    };
  }, [client, patient.token, historyVersion]);

  function save({ pick, patientId, client, sessionResult }: Session) {
    void client.save(sessionResult).then((outcome) => {
      if (chosenPatientId.current !== patientId) return;
      if (outcome === "saved") setHistoryVersion((version) => version + 1);
      if (shownPick.current !== pick) return;
      setSession((shown) => shown && { ...shown, sending: false, outcome });
    });
  }

  /** Forgets the shown Session, saved or not, and drops any answer about it. */
  function discardSession() {
    shownPick.current = Symbol("pick");
    setSession(undefined);
    setRefusal(undefined);
  }

  /**
   * Another Patient discards the current Session, so a Retry can never save
   * one Patient's Session into another's history.
   */
  function choosePatient(id: string) {
    const chosen = patients.find((candidate) => candidate.id === id);
    if (!chosen || chosen.id === patient.id) return;
    discardSession();
    chosenPatientId.current = chosen.id;
    setPatient(chosen);
  }

  /** Sends the very same Session Result again, so the server sees a Resend. */
  function retry(failed: Session) {
    setSession({ ...failed, sending: true });
    save(failed);
  }

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared, so picking the same file again is a new pick.
    event.target.value = "";
    if (!file) return;
    discardSession();
    const pick = shownPick.current;
    // The Session was performed before its file was picked, not once read.
    const performedAt = new Date().toISOString();
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      json = NOT_JSON;
    }
    // Another Patient chosen, or another file picked, while this one was read.
    if (shownPick.current !== pick) return;
    if (json === NOT_JSON) {
      setRefusal({ refused: `${file.name} is not a JSON file.`, problems: [] });
      return;
    }
    const parsed = parseRecording(json);
    if (!parsed.ok) {
      setRefusal({
        refused: `${file.name} is not a Recording:`,
        problems: parsed.problems,
      });
      return;
    }
    const sessionResult = sessionResultOf(parsed.recording, {
      sessionId: crypto.randomUUID(),
      performedAt,
    });
    const picked = {
      pick,
      patientId: patient.id,
      client,
      recording: parsed.recording,
      sessionResult,
      sending: true,
    };
    setSession(picked);
    save(picked);
  }

  return (
    <main>
      <h1>Rep Counter</h1>
      <label>
        Patient{" "}
        <select
          value={patient.id}
          onChange={(event) => choosePatient(event.target.value)}
        >
          {patients.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <section aria-labelledby="session-heading">
        <h2 id="session-heading">New Session</h2>
        <label>
          Recording{" "}
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => void pickFile(event)}
          />
        </label>
        {refusal && (
          <div role="alert">
            <p>{refusal.refused}</p>
            {refusal.problems.length > 0 && (
              <ul>
                {refusal.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {session && (
          <CountedSession session={session} onRetry={() => retry(session)} />
        )}
      </section>
      <section aria-labelledby="history-heading">
        <h2 id="history-heading">Sessions</h2>
        <SessionHistory
          listed={history?.token === patient.token ? history.listed : undefined}
        />
      </section>
    </main>
  );
}

/** The picked Recording's count, and how saving its Session Result went. */
function CountedSession({
  session,
  onRetry,
}: {
  session: Session;
  onRetry: () => void;
}) {
  const { recording, sessionResult, sending, outcome } = session;
  return (
    <>
      <dl>
        <dt>Reps</dt>
        <dd>
          {sessionResult.reps}
          {recording.expectedReps !== undefined &&
            ` (expected ${recording.expectedReps})`}
        </dd>
        <dt>Duration</dt>
        <dd>{sessionResult.durationSec.toFixed(1)} s</dd>
      </dl>
      <p role="status">
        {sending ? "Saving…" : outcome === "saved" && "Saved"}
      </p>
      {outcome === "conflict" && (
        <p role="alert">
          Not saved: this Session was already saved with different values.
        </p>
      )}
      {outcome === "refused" && (
        <p role="alert">Not saved: the server refused this Session.</p>
      )}
      {isFailure(outcome) && (
        <>
          <p role="alert">Not saved.</p>
          <button type="button" disabled={sending} onClick={onRetry}>
            Retry
          </button>
        </>
      )}
    </>
  );
}

function isFailure(outcome: SaveOutcome | undefined) {
  return (
    outcome === "network" || outcome === "server" || outcome === "malformed"
  );
}

/** The listed history, or its loading, empty or error state. */
function SessionHistory({
  listed,
}: {
  listed: ListedSessionResults | undefined;
}) {
  if (!listed) return <p>Loading Sessions…</p>;
  if (!listed.ok) {
    return <p role="alert">Could not load the Session history.</p>;
  }
  if (listed.sessionResults.length === 0) return <p>No Sessions yet</p>;
  return <SessionTable sessionResults={listed.sessionResults} />;
}

function SessionTable({ sessionResults }: { sessionResults: SessionResult[] }) {
  return (
    <table aria-label="Session history">
      <thead>
        <tr>
          <th scope="col">Performed</th>
          <th scope="col">Reps</th>
          <th scope="col">Duration</th>
        </tr>
      </thead>
      <tbody>
        {sessionResults.map((sessionResult) => (
          <tr key={sessionResult.sessionId}>
            <td>
              <time dateTime={sessionResult.performedAt}>
                {new Date(sessionResult.performedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </td>
            <td>{sessionResult.reps}</td>
            <td>{sessionResult.durationSec.toFixed(1)} s</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
  client: SessionResultClient;
  recording: Recording;
  sessionResult: SessionResult;
  /** Whether a save is in flight. */
  sending: boolean;
  /** How the last save ended; none yet while the first is in flight. */
  outcome?: SaveOutcome;
};

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
  // The Session Result on show, so an answer about an older one is dropped.
  const shownSessionResult = useRef<SessionResult>(undefined);

  useEffect(() => {
    let current = true;
    void client.list().then((listed) => {
      if (current) setHistory({ token: patient.token, listed });
    });
    return () => {
      current = false;
    };
  }, [client, patient.token, historyVersion]);

  function save({ client, sessionResult }: Session) {
    void client.save(sessionResult).then((outcome) => {
      if (shownSessionResult.current !== sessionResult) return;
      setSession((shown) => shown && { ...shown, sending: false, outcome });
      if (outcome === "saved") setHistoryVersion((version) => version + 1);
    });
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared, so picking the same file again is a new pick.
    event.target.value = "";
    if (!file) return;
    const parsed = parseRecording(JSON.parse(await file.text()));
    if (!parsed.ok) return;
    const sessionResult = sessionResultOf(parsed.recording, {
      sessionId: crypto.randomUUID(),
      performedAt: new Date().toISOString(),
    });
    const picked = {
      client,
      recording: parsed.recording,
      sessionResult,
      sending: true,
    };
    shownSessionResult.current = sessionResult;
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
          onChange={(event) =>
            setPatient(
              patients.find(({ id }) => id === event.target.value) ?? patient,
            )
          }
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
            onChange={(event) => void pick(event)}
          />
        </label>
        {session && <CountedSession session={session} />}
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
function CountedSession({ session }: { session: Session }) {
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
    </>
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

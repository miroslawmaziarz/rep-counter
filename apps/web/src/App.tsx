import { patients, type SessionResult } from "@rep-counter/core";
import { useEffect, useState } from "react";
import {
  sessionResultClient,
  type ListedSessionResults,
} from "./session-result-client";

export function App() {
  const patient = patients[0]!;
  // Kept with the token it was listed for, so another Patient's history
  // reads as still loading rather than as theirs.
  const [history, setHistory] = useState<{
    token: string;
    listed: ListedSessionResults;
  }>();

  useEffect(() => {
    let current = true;
    void sessionResultClient(patient.token)
      .list()
      .then((listed) => {
        if (current) setHistory({ token: patient.token, listed });
      });
    return () => {
      current = false;
    };
  }, [patient.token]);

  return (
    <main>
      <h1>Rep Counter</h1>
      <section aria-labelledby="history-heading">
        <h2 id="history-heading">Sessions</h2>
        <SessionHistory
          listed={history?.token === patient.token ? history.listed : undefined}
        />
      </section>
    </main>
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

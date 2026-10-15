import { patients, type SessionResult } from "@rep-counter/core";
import { useEffect, useState } from "react";
import { sessionResultClient } from "./session-result-client";

export function App() {
  const patient = patients[0]!;
  const [sessionResults, setSessionResults] = useState<SessionResult[]>();

  useEffect(() => {
    let current = true;
    void sessionResultClient(patient.token)
      .list()
      .then((listed) => {
        if (current && listed.ok) setSessionResults(listed.sessionResults);
      });
    return () => {
      current = false;
    };
  }, [patient.token]);

  return (
    <main>
      <h1>Rep Counter</h1>
      {sessionResults && <SessionHistory sessionResults={sessionResults} />}
    </main>
  );
}

function SessionHistory({
  sessionResults,
}: {
  sessionResults: SessionResult[];
}) {
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

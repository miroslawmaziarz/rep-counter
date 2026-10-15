# Rep Counter

Take-home task for Physitrack MoCap. A patient does squats in front of a camera, the browser turns the video into one knee angle per frame, and this app counts the squats and keeps a history of sessions.

Stack: Node, TypeScript, React.

> **Status:** the workspace, tooling and app shells are in place: the web app shows whether the API is reachable. Rep counting and the Session Result API and history are not yet added.

## Getting started

Requires Node 22.22.2 or newer within 22.x (see `.nvmrc`; run `nvm use`).

```sh
npm install
npm start   # API on http://localhost:3000, web app on http://localhost:5173
npm test
```

If port 3000 is taken, run `PORT=3001 npm start`; the API and the web app's proxy both follow `PORT`.

## Pull requests

Each PR has one scope; the rule is in `AGENTS.md`. The `PR scopes` workflow checks it and sets the PR's `scope:*` label.

The check is advisory: branch protection isn't available on this private repository's GitHub plan, so a failing check can't block a merge.

## What counts as one rep

The knee angle goes **below 100°**, then comes back **above 160°**. Nothing else counts.

## Repository contents

| Path                                          | Description                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `rep-counter-v2.html`                         | The original task brief (open in a browser).                                                       |
| `packages/core/fixtures/session-clean.json`   | Ten full squats, clean signal. Expected reps: 10.                                                  |
| `packages/core/fixtures/session-noisy.json`   | Eight full squats; noisy tracking, and the patient pauses at the bottom of each. Expected reps: 8. |
| `packages/core/fixtures/session-shallow.json` | Ten attempts; three only go halfway down. Expected reps: 7.                                        |

## Fixture format

Recordings are sampled at 30 frames per second.

```json
{
  "description": "...",
  "expectedReps": 10,
  "sampleRateHz": 30,
  "angles": [171.2, 172.4, "..."]
}
```

## Planned scope

1. `countReps(angles)` in TypeScript, tested against the fixtures.
2. Backend (Node + TypeScript):
   - `POST /sessions` saves `{ sessionId, reps, durationSec, performedAt }`. It must be idempotent: the same `sessionId` is saved once, since devices retry.
   - `GET /sessions` lists the caller's sessions.
   - Every request needs a token, and a patient sees only their own sessions (a hard-coded token per user is fine).
3. Frontend (React + TypeScript): pick a fixture, count reps in the browser, send the result, show the session list. Raw angles never leave the browser; only the result is sent.

## Assumptions

_To be filled in as the implementation lands._

## AI agent notes

_Agent instructions file and a note on one thing the agent got wrong: to be added._

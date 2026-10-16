# Rep Counter

Take-home task for Physitrack MoCap: count squats from per-frame knee angles in the browser and keep each Patient's history of Sessions. The brief is [`rep-counter-v2.html`](rep-counter-v2.html).

## Run it

Requires Node 22 (see `.nvmrc`; run `nvm use`).

```sh
npm install
npm start   # API on http://localhost:3000, web app on http://localhost:5173
npm test    # unit, API and Fixture acceptance tests
npm run check   # lint, format, typecheck, dependency rules
```

If port 3000 is taken, run `PORT=3001 npm start`.

1. Open http://localhost:5173 and choose a Patient (Julia or Franek).
2. Under **New Session**, pick a Recording from `packages/core/fixtures/`, such as `session-clean.json`.
3. The browser counts the Reps and saves only the Session Result (`sessionId`, `reps`, `durationSec`, `performedAt`); the angles never leave the browser. The history below updates.

To call the API directly, send a demo token (`julia-token` or `franek-token`):

```sh
curl -H "Authorization: Bearer julia-token" http://localhost:3000/sessions
```

## Assumptions

- **Technology.** I chose Node, TypeScript, Fastify, React with Vite and SQLite (Node's built-in `node:sqlite`) as the most straightforward stack: one language across browser and server, and no extra service to start.
- **A Rep** is the knee angle going below 100°, then back above 160°. The gap between the thresholds absorbs noise and pauses at the bottom. A Recording ending deep gets no credit for the last Rep.
- **The Rep rule is one function, not a strategy hierarchy.** I skipped a strategy pattern for Rep counting. `countReps` already takes the thresholds as a parameter, so another exercise, or a strategy per exercise, is easy to add to the current code when it's needed.
- **Modularisation as an AI-assisted coding principle.** The code is split into small deep modules (a pure shared `core`, `server`, `web`), each owning one rule. A real application could give each module its own glossary, architecture notes and agent files, so an agent works with a small, well-described context.
- **Sessions.** Picking a Recording starts a new Session with a fresh `sessionId`; `performedAt` is the moment of the pick. `durationSec` is the whole Recording's length. A Session with 0 Reps is still saved.
- **Saving once.** `sessionId` is unique per Patient. A Resend of the same Session Result is saved once (`200`); different values for the same `sessionId` get `409`. See [ADR 0002](docs/adr/0002-resends-saved-once-per-patient.md).
- **Patients.** Two demo Patients with hard-coded tokens stand in for sign-in; the web app ships both tokens, so this is for the demo only.
- **Times** are shown in the browser's own time zone.

## Working with AI

I built this with [Claude Code](https://claude.com/claude-code), steering and reviewing rather than typing the code. The agent's instructions are in [`AGENTS.md`](AGENTS.md), the domain language in [`GLOSSARY.md`](GLOSSARY.md), decisions in [`docs/adr/`](docs/adr/), and the trail of the work in the [issues](https://github.com/miroslawmaziarz/rep-counter/issues?q=is%3Aissue) and [pull requests](https://github.com/miroslawmaziarz/rep-counter/pulls?q=is%3Apr).

Corrections I made to the agent's work:

- **Big PRs.** I rejected big PRs that mixed several layers. I set out how a PR should look: one scope (`core`, `server` or `web`), changes across layers as stacked PRs. A script now checks it locally and in CI.
- **PR naming.** I set the title rule `<scope>: <Sentence>` with fixed prefixes, so PRs are easy to filter, label and follow.
- **`countReps` as business logic.** I asked to keep `countReps` as an abstract piece of business logic and to take the threshold angles as a parameter. With that it can count squats, and also other exercises with different thresholds, such as lunges.
- **Routes in one place.** During review I noticed the agent had put some route logic, the list of public routes, in the patient-resolution module. I asked for it to move to the app, so all the routes are in one place.
- **Time zone.** Reviewing the "Show a Patient's Session history" PR, I found the code forced the Europe/Warsaw time zone, ignoring the browser's. I asked for it to read the browser's setting instead.
- **401 for unknown endpoints.** Reviewing the API, I noticed an unknown endpoint returned `401`. I asked for `404` instead.

## What I'd do next

- Clear modularisation rules that avoid code entropy.
- Dedicated agent for UI, dedicated agent for API, dedicated agent for domain logic. Each would own its own AGENTS.md, GLOSSARY.md, and ADRs (see Assumptions).
- Automatic retries with backoff for a failed save, and queueing unsaved Session Results.
- An end-to-end test across the browser and the API.

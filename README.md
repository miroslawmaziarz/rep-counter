# Rep Counter

Take-home task for Physitrack MoCap. A patient does squats in front of a camera, the browser turns the video into one knee angle per frame, and this app counts the squats and keeps a history of sessions.

Stack: Node, TypeScript, React.

> **Status:** every part of the brief is built: `countReps` tested against the Fixtures, `POST /sessions` saving each Session Result once, `GET /sessions` scoped to the calling Patient, and a web app that counts a picked Recording in the browser, saves only its Session Result and shows the Patient's history. See [What I'd do next](#what-id-do-next) for what is left.

## Getting started

Requires Node 22.22.2 or newer within 22.x (see `.nvmrc`; run `nvm use`).

```sh
npm install
npm start   # API on http://localhost:3000, web app on http://localhost:5173
npm test
```

If port 3000 is taken, run `PORT=3001 npm start`; the API and the web app's proxy both follow `PORT`.

## Counting a Recording

1. Run `npm start` and open http://localhost:5173.
2. Choose the Patient.
3. Under **New Session**, click the **Recording** file input and pick a Fixture from `packages/core/fixtures/`, such as `session-clean.json`. Any JSON file in the [Fixture format](#fixture-format) works.

The browser counts the Reps and shows them with the duration and, for a Fixture, its expected Reps. It then saves the Session Result (`sessionId`, `reps`, `durationSec`, `performedAt`) at once; the angles never leave the browser. Each pick is a new Session, even of the same file. If the save fails, **Retry** sends the same Session Result again, which the server saves once. Choosing another Patient discards the current Session.

## Patients and tokens

Every request to the API except `GET /health` must send `Authorization: Bearer <token>` for one of the demo Patients. Anything else gets `401`.

| Patient | Token          |
| ------- | -------------- |
| Julia   | `julia-token`  |
| Franek  | `franek-token` |

```sh
curl -H "Authorization: Bearer julia-token" http://localhost:3000/sessions
```

These tokens are for the demo only. They are hard-coded in `packages/core/src/patients/patients.json`, and the web app ships every Patient's token to the browser, so anyone with the bundle can act as any Patient. A real deployment would issue tokens at sign-in.

## Pull requests

Each PR has one scope; the rule is in `AGENTS.md`. The `PR scopes` workflow checks it and sets the PR's `scope:*` label.

The check is advisory: it isn't a required status check yet, so a failing check doesn't block a merge.

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

## Assumptions

**Rep counting**

- A Rep is the Knee Angle going strictly below 100°, then strictly above 160°. The gap between the two thresholds absorbs noise and pauses at the bottom, so dipping below 100° again before standing up is still one Rep.
- A Recording that starts deep counts its first Rep; one that ends deep gets no credit for the last.
- The thresholds are configurable in `countReps`, with the brief's values as defaults.

**Sessions and Session Results**

- Picking a Recording file starts a new Session. The browser gives it a fresh `sessionId` (a UUID) and takes `performedAt` at the moment of the pick, since a Recording carries no timestamp. Picking the same file again is a new Session, not a Resend.
- `durationSec` is the length of the whole Recording: frames / `sampleRateHz` (300 frames at 30 Hz is 10.0 s). Not the time of one Rep, and not the time from the first Rep to the last, which is undefined with no Reps.
- A Session with 0 Reps is still saved: showing up and doing no valid squat is history worth keeping.
- A Session Result is validated strictly, by one parser shared by the browser and the server: no extra fields, `sessionId` 1–128 characters, `reps` an integer ≥ 0, `durationSec` > 0, `performedAt` an RFC 3339 date-time (stored in UTC).

**Saving once**

- `sessionId` is unique per Patient, not globally, so one Patient can't collide with or probe another's ids.
- The first save returns `201`. An identical Resend returns `200` with the stored Session Result. A Resend with different values returns `409` and leaves the original untouched. A database unique key enforces it, so concurrent Resends can't both be saved. Details in [ADR 0002](docs/adr/0002-resends-saved-once-per-patient.md).
- The web app saves as soon as the Reps are counted. On a network error, a 5xx or a 10 s timeout it offers **Retry**, which resends the identical Session Result. Any other 4xx is shown as refused, with no Retry, since resending can't fix it.

**Patients and storage**

- Two demo Patients with hard-coded tokens stand in for sign-in; the web app's Patient selector picks whose token is sent. Switching Patient discards an unsaved Session, so it can't land in someone else's history.
- Session Results are stored in SQLite through Node's built-in `node:sqlite` (`apps/server/data/`, gitignored): no extra service, so the repo starts with one command. It is still experimental on Node 22 and prints a warning.
- Times are shown in the viewer's local time.

## How I worked with AI

I built this with [Claude Code](https://claude.com/claude-code), steering and reviewing rather than typing the code. What to look at:

- **[`AGENTS.md`](AGENTS.md)** (loaded through `CLAUDE.md`): the instructions file. It sets the layout, the domain language, test-first, small commits and one scope per PR.
- **[`GLOSSARY.md`](GLOSSARY.md)**: the domain language, kept up to date as terms settled, so code, tests, issues and commits use the same words.
- **[`docs/adr/`](docs/adr/)** and **[`docs/architecture.md`](docs/architecture.md)**: the decisions and the module map the agent reads before changing structure.
- **[`docs/agents/`](docs/agents/)**: how the agent uses the issue tracker and its triage labels.
- **The [issues](https://github.com/miroslawmaziarz/rep-counter/issues?q=is%3Aissue) and [pull requests](https://github.com/miroslawmaziarz/rep-counter/pulls?q=is%3Apr)**: the trail of the work.

The loop for each feature:

1. **Design by interview.** The agent questions me one round at a time, recommending an answer each time, until every decision is settled (for example, what `durationSec` measures, or whether Retry reuses the `sessionId` and `performedAt`). New terms go into the glossary; hard-to-reverse choices become ADRs.
2. **Tickets.** The agreed design becomes GitHub issues, one scope each (`core`, `server` or `web`), linked by "blocked by".
3. **Implementation.** Sub-agents each take one ticket in their own git worktree, test-first, in small commits, running in parallel where the dependencies allow.
4. **Review.** Two separate review agents check the result: one against the repo's standards, one against the issue. Their findings go back to an implementer before the PR is merged. This caught, for example, Retry being offered for a `400` that resending can never fix.

### One thing it got wrong, and how I noticed

Early on, the agent opened one pull request that changed both `core` and `server`. I noticed it in review: a mixed PR is harder to review and to revert, and it hid the dependency between the two changes. Rather than only fixing that PR, I turned the rule into something that can't be forgotten: `AGENTS.md` now says one scope per PR, cross-workspace changes go through expand–contract, and [`scripts/pr-scope.js`](scripts/pr-scope.js) checks it locally (`npm run pr-scope`) and in CI, labelling each PR with its scope (#21).

A second one: the agent told me some stacked PRs (#18, #19) were ready, but they targeted their base branches, not `main`, so merging them left their code off `main`. They were redone as #24 and #25, and the agent now checks a PR's base before calling it ready.

### A note on the git history

Commits are kept as made. Up to #12, PRs were merged with merge commits. Later PRs (#17 onwards) were squash-merged by mistake, so `main` shows one commit per PR; each PR's page still has its individual commits.

## What I'd do next

- **Real sign-in** instead of demo tokens in the bundle: the server would issue a token per Patient, and the Patient selector would go.
- **Automatic retries with backoff** for a failed save, on top of the manual Retry, keeping the same `sessionId` and `performedAt` so retries stay Resends.
- **Saves that survive a reload:** queue unsaved Session Results in the browser until the server confirms them.
- **Show the Recording:** chart the Knee Angle with the two thresholds and mark each counted Rep, so a physio can see why a squat didn't count.
- **Tests and tooling:** coverage thresholds (#28), mutation testing of core (#29), an end-to-end test across the browser and the API, and making the scope check a required status check.
- **Code:** move the Session UI into its own module folder, as the other modules are.

# Rep Counter

Take-home task: count squat Reps from per-frame Knee Angles and keep each Patient's history of Session Results. The brief is `rep-counter-v2.html`; read it before starting a feature.

## Language

`GLOSSARY.md` is the domain vocabulary. Name code, tests and commits with its terms (Patient, Session, Recording, Rep, Session Result). When a new term settles, add it to the glossary in the same change.

## Layout

- `packages/core`: pure domain code shared by server and web. It stays pure, with no DOM, Node APIs or I/O, so it runs identically in the browser and in Vitest. Consumed as TypeScript source with no build step.
- `apps/server`: Fastify API. Routes use the brief's paths (`/sessions`, `/health`).
- `apps/web`: Vite + React. It calls the API under `/api/*`; the Vite proxy strips the prefix.
- `packages/core/fixtures/`: sample Recordings, each labelled with its expected Rep count; the acceptance tests for Rep counting.
- `scripts/`: dependency-free repo tooling in plain Node, such as the PR scope check; tested with `node --test` from the root `npm test`.
- `docs/adr/`: decisions and the reasons behind them. Read them before changing structure.
- `docs/architecture.md`: the module map. Read it before adding or reshaping a module, and update its row in the same PR.

## Rules

- **Recordings stay in the browser.** Only the Session Result crosses the network.
- **Deep modules:** a small interface over a lot of hidden behaviour, tested through that interface. Each rule (the Rep rule, idempotency, Patient scoping) lives inside the one module that owns it.
- **Test-first** for `core` and the API: write a red test, make it green, then refactor. The Fixtures are the acceptance tests for Rep counting.
- **Each PR keeps its scope.** Build what its GitHub issue lists and tick its acceptance criteria; record follow-up ideas in the PR body.
- **Git history is part of the deliverable.** Make small, logical commits on a feature branch and add new commits on top of existing ones.
- **One scope per PR.** A PR changes at most one workspace: `core`, `server` or `web`. Root files (the lockfile, `docs/`, `GLOSSARY.md`, `README.md`, `.github/`, `scripts/`, root config) ride along and add no scope; `repo` is the scope only when no workspace changes. The title is exactly `<scope>: <Sentence>`, e.g. `server: Save a Session Result`. PRs are merged with a merge commit, not squashed, so the title becomes the merge message.
- **Check the scope before opening a PR:** `npm run pr-scope -- "<title>"` (add `--base <branch>` for a stacked PR). CI runs the same check against the PR's base and sets its `scope:*` label.
- **Change across workspaces with expand–contract**, never one PR. To rename a core export the server uses: a `core:` PR adds the new name beside the old one, a `server:` PR switches over, and a `core:` PR removes the old name. Shared dev dependencies live at the root, so bumping them is `repo:`.
- **Issues are single-scope too.** Each issue targets one scope and ends with "The PR is titled `<scope>: …`". Work that spans layers becomes issues ordered core → server → web, linked by `Blocked by`, with stacked PRs.
- **Done** means `npm run check` and `npm test` both pass on Node 22 (`.nvmrc`).

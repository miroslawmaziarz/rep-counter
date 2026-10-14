# Rep Counter

Take-home task: count squat Reps from per-frame Knee Angles and keep each Patient's history of Session Results. The brief is `rep-counter-v2.html`; read it before starting a feature.

## Language

`GLOSSARY.md` is the domain vocabulary. Name code, tests and commits with its terms (Patient, Session, Recording, Rep, Session Result). When a new term settles, add it to the glossary in the same change.

## Layout

- `packages/core`: pure domain code shared by server and web. It stays pure, with no DOM, Node APIs or I/O, so it runs identically in the browser and in Vitest. Consumed as TypeScript source with no build step.
- `apps/server`: Fastify API. Routes use the brief's paths (`/sessions`, `/health`).
- `apps/web`: Vite + React. It calls the API under `/api/*`; the Vite proxy strips the prefix.
- `fixtures/`: sample Recordings, each labelled with its expected Rep count.
- `docs/adr/`: decisions and the reasons behind them. Read them before changing structure.
- `docs/architecture.md`: the module map. Read it before adding or reshaping a module, and update its row in the same PR.

## Rules

- **Recordings stay in the browser.** Only the Session Result crosses the network.
- **Deep modules:** a small interface over a lot of hidden behaviour, tested through that interface. Each rule (the Rep rule, idempotency, Patient scoping) lives inside the one module that owns it.
- **Test-first** for `core` and the API: write a red test, make it green, then refactor. The Fixtures are the acceptance tests for Rep counting.
- **Each PR keeps its scope.** Build what its GitHub issue lists and tick its acceptance criteria; record follow-up ideas in the PR body.
- **Git history is part of the deliverable.** Make small, logical commits on a feature branch and add new commits on top of existing ones.
- **Done** means `npm run check` and `npm test` both pass on Node 22 (`.nvmrc`).

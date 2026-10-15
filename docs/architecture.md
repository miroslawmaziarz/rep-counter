# Architecture

The module map: what each module owns, what crosses its interface, and where its tests cut in. Update the row in the PR that builds or changes the module.

## Principles

We design **deep modules**: a lot of behaviour behind a small interface.

- **Interface** means everything a caller must know: the types, plus the invariants, error modes and ordering rules.
- **Tests go through the interface.** A test that needs to reach past it means the module has the wrong shape.
- **The deletion test:** if deleting a module would only move complexity, it is a pass-through. Fold it into its caller.
- **A seam needs two adapters.** Add one only when something actually varies across it.
- **Rules belong inside the module that owns them.** Idempotency, Patient scoping and the Rep rule each live in exactly one module, not in their callers.

## Layout

```text
packages/core/   pure domain code: no DOM, Node APIs or I/O (ADR 0001)
apps/server/     Fastify; owns Patients and Session Result history
apps/web/        React; owns Recordings, which never leave the browser
```

Allowed dependencies: `web → core` and `server → core`. Nothing depends on an app. `server` and `web` talk only over HTTP.

## Packaging

Each level of nesting has one interface, and dependency-cruiser enforces it as part of `npm run check` (rules in `.dependency-cruiser.cjs`).

- **A package's interface is its `exports` map.** Packages are internal workspace packages consumed as TypeScript source, with no build step (ADR 0001). Each package exports only `"."`. Import a package by its name, never by a path into its `src/`.
- **A module is a folder directly under a package's `src/`, and its interface is that folder's `index.ts`.** Everything else in the folder is internal: only files in the same folder may import it. TypeScript can't express folder-private files, so this is the rule that holds the line.
- **Each workspace imports only what its own `package.json` declares, plus the root dev tooling.** npm hoists every dependency into one `node_modules`, so without the check `server` could import `react`.
- **`core` stays pure:** no Node built-ins, no frameworks and no apps.
- **No circular imports.**

To start a new module, create the folder and its `index.ts`, then add a row to the module map below.

## Module map

| Module                         | Lives in | Owns (hidden behind its interface)                                                                                                                         | In → out                                                               | Tested through                                                               | Status                                                 |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Rep counting** (`countReps`) | core     | The Rep rule with configurable `RepThresholds` (defaults: below 100°, then back above 160°), and the hysteresis between them that absorbs noise and pauses | Recording (+ optional thresholds) → Rep count                          | Its interface, with the Fixtures as acceptance tests                         | Exists; duration comes later with the web Session flow |
| **Session Result history**     | server   | Saving each `(Patient, sessionId)` once, reads scoped to a Patient, the SQL and the schema                                                                 | Patient + Session Result → saved once; Patient → their Session Results | The same module on an in-memory `node:sqlite` database, with no fake adapter | Planned                                                |
| **Patients** (`patients`)      | core     | The list of Patients (`id`, `name`, demo `token`) as plain data, and the `Patient` type                                                                    | → every Patient                                                        | Through the server's Patient resolution; it holds no behaviour of its own    | Exists (Julia and Franek)                              |
| **Patient resolution**         | server   | The token table, header parsing, and rejecting unknown tokens                                                                                              | Request → Patient, or 401                                              | The HTTP app through `inject()`                                              | Proposed                                               |
| **Session Result client**      | web      | The `/api` prefix, the token, resending the same `sessionId` on retry, and mapping errors to failure states                                                | Session Result → saved or failed; → list of Session Results            | Its interface, with `fetch` stubbed                                          | Proposed                                               |
| **HTTP app** (`buildApp`)      | server   | Fastify wiring and routes                                                                                                                                  | HTTP request → response                                                | `inject()`, with no port opened                                              | Exists (`/health` only)                                |
| **Health indicator** (`App`)   | web      | Polling `/api/health`                                                                                                                                      | → "API: ok" or "API: unreachable"                                      | Rendering with `fetch` stubbed                                               | Exists; to be replaced by the Session UI               |

Open question: should core own one Session Result contract (shape and validation) that server and web both import? Decide it when the second side needs it.

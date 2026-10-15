# npm workspaces with a pure `core` package

`countReps` runs in the browser (Recordings never leave it), yet it must be tested in Node against the Fixtures, and the server and web share the Session Result contract. We therefore use an npm workspaces monorepo: `packages/core` holds pure domain code (no DOM, Node APIs or I/O), and `apps/server` and `apps/web` import it. `core` is consumed as TypeScript source with no build step, because Vite and `tsx` both compile it and nothing is published.

## Considered Options

- **Two apps (`server/`, `web/`), with `countReps` inside `web`**: the contract types would be duplicated, and the algorithm's tests would be tied to the browser app's tooling.
- **A single package**: the boundary between pure domain code and framework code would not be enforced.
- **Building `core` to `dist/`**: adds build ordering and watch-mode coordination for no benefit, since nothing is published.

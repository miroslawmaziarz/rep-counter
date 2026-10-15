# Resends are saved once per Patient

Devices retry `POST /sessions` on bad connections, so a Session Result can arrive more than once. We key Session Results by `(Patient, sessionId)`. The first save returns `201`. An identical Resend returns `200` with the stored Session Result. A conflicting Resend, one with different values, returns `409` and leaves the original untouched. `performedAt` is normalised to UTC before it is compared and stored, so `…Z` and `…+00:00` count as the same instant. The rule is enforced by a unique key in the database (`INSERT … ON CONFLICT DO NOTHING`, then read back), not by a check-then-insert in code, so two concurrent Resends cannot both be saved.

Session Results are stored with `node:sqlite`: a file when running, `:memory:` in tests through the same module. It needs no extra dependency or service, so the repo still starts with one command. The cost is that the module is still experimental on Node 22 and prints a warning.

## Considered Options

- **A globally unique `sessionId`**: one Patient's Resend could collide with another Patient's Session Result, and the `409` would reveal that the id exists.
- **`201` for every Resend**: simpler for clients, but it hides whether anything was saved. Clients treat both `200` and `201` as success anyway.
- **Last write wins on a conflicting Resend**: it breaks "saved once" and silently rewrites history.
- **First write wins with no signal**: it hides a client bug that sends two different Session Results under one `sessionId`.
- **In-memory storage only**: history would vanish on every restart.

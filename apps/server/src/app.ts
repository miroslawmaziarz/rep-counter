import { parseSessionResult } from "@rep-counter/core";
import Fastify, { type FastifyInstance } from "fastify";
import { httpError } from "./http-error";
import { resolvePatients } from "./patient-resolution";
import { openSessionResultHistory } from "./session-result-history";

export type AppOptions = {
  /** Where Session Results are kept: a `node:sqlite` file, or `:memory:`. */
  databasePath: string;
};

export function buildApp({ databasePath }: AppOptions): FastifyInstance {
  const app = Fastify();
  resolvePatients(app);

  const history = openSessionResultHistory(databasePath);
  app.addHook("onClose", async () => history.close());

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/sessions", async (request) => history.list(request.patient));

  app.post("/sessions", async (request, reply) => {
    const parsed = parseSessionResult(request.body);
    if (!parsed.ok) throw httpError(400, parsed.problems.join("; "));

    const { outcome, sessionResult } = history.save(
      request.patient,
      parsed.sessionResult,
    );
    if (outcome === "conflict") {
      throw httpError(
        409,
        "A different Session Result is already saved for this sessionId",
      );
    }
    return reply.code(STATUS_BY_OUTCOME[outcome]).send(sessionResult);
  });

  return app;
}

const STATUS_BY_OUTCOME = { saved: 201, resent: 200 } as const;

import Fastify, { type FastifyInstance } from "fastify";
import { resolvePatients } from "./patient-resolution";
import {
  openSessionResultHistory,
  type SessionResult,
} from "./session-result-history";

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

  app.get("/sessions", async (request) => history.list(request.patient.id));

  app.post<{ Body: SessionResult }>("/sessions", async (request, reply) => {
    const { sessionResult } = history.save(request.patient.id, request.body);
    return reply.code(201).send(sessionResult);
  });

  return app;
}

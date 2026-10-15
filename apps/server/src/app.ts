import Fastify, { type FastifyInstance } from "fastify";
import { resolvePatients } from "./patient-resolution";

export function buildApp(): FastifyInstance {
  const app = Fastify();
  resolvePatients(app);

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/sessions", async () => []);

  return app;
}

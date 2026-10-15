import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify();

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/sessions", async () => []);

  return app;
}

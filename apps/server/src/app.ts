import { parseSessionResult, type Patient } from "@rep-counter/core";
import Fastify, { type FastifyInstance } from "fastify";
import { httpError } from "./http-error";
import { patientFor } from "./patient-resolution";
import { openSessionResultHistory } from "./session-result-history";

declare module "fastify" {
  interface FastifyRequest {
    /** The Patient making the request. Set on the routes that need one. */
    patient: Patient;
  }
}

export type AppOptions = {
  /** Where Session Results are kept: a `node:sqlite` file, or `:memory:`. */
  databasePath: string;
};

export function buildApp({ databasePath }: AppOptions): FastifyInstance {
  const app = Fastify();
  app.decorateRequest("patient", null as unknown as Patient);

  const history = openSessionResultHistory(databasePath);
  app.addHook("onClose", async () => history.close());

  // Public routes.
  app.get("/health", async () => ({ status: "ok" }));

  // Routes that need a Patient. A hook in this scope runs only for its
  // routes, so a request to no route is a 404 with or without a token.
  void app.register(async (patientScope) => {
    patientScope.addHook("onRequest", async (request) => {
      const patient = patientFor(request.headers.authorization);
      if (!patient) throw httpError(401, "Unauthorized");
      request.patient = patient;
    });

    patientScope.get("/sessions", async (request) =>
      history.list(request.patient),
    );

    patientScope.post("/sessions", async (request, reply) => {
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
  });

  return app;
}

const STATUS_BY_OUTCOME = { saved: 201, resent: 200 } as const;

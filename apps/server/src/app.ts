import Fastify, { type FastifyInstance } from "fastify";
import { httpError } from "./http-error";
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
  // Strict bodies: reject extra fields and wrong types rather than strip or coerce them.
  const app = Fastify({
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  resolvePatients(app);

  const history = openSessionResultHistory(databasePath);
  app.addHook("onClose", async () => history.close());

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/sessions", async (request) => history.list(request.patient));

  app.post<{ Body: SessionResult }>(
    "/sessions",
    { schema: { body: SESSION_RESULT_SCHEMA } },
    async (request, reply) => {
      const { outcome, sessionResult } = history.save(
        request.patient,
        request.body,
      );
      if (outcome === "conflict") {
        throw httpError(
          409,
          "A different Session Result is already saved for this sessionId",
        );
      }
      return reply.code(STATUS_BY_OUTCOME[outcome]).send(sessionResult);
    },
  );

  return app;
}

/** The Session Result a Patient sends. Anything else is a 400. */
const SESSION_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId", "reps", "durationSec", "performedAt"],
  properties: {
    sessionId: { type: "string", minLength: 1, maxLength: 128 },
    reps: { type: "integer", minimum: 0 },
    durationSec: { type: "number", exclusiveMinimum: 0 },
    performedAt: {
      type: "string",
      format: "date-time",
      // Strict RFC 3339, the subset `new Date()` parses exactly: uppercase
      // `T` and `Z`, seconds below 60 (a Date cannot hold a leap second), at
      // most millisecond precision, and an offset of `Z` or `±HH:MM`.
      pattern:
        "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:[0-5]\\d(\\.\\d{1,3})?(Z|[+-]\\d{2}:\\d{2})$",
    },
  },
} as const;

const STATUS_BY_OUTCOME = { saved: 201, resent: 200 } as const;

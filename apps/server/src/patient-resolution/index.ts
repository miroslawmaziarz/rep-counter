import { patients, type Patient } from "@rep-counter/core";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { httpError } from "../http-error";

declare module "fastify" {
  interface FastifyRequest {
    /** The Patient making the request. Set on every route but `/health`. */
    patient: Patient;
  }
}

/** Routes anyone may call without a token. */
const PUBLIC_URLS = new Set(["/health"]);

const PATIENTS_BY_TOKEN = new Map(
  patients.map((patient) => [patient.token, patient]),
);

/**
 * Requires every request but `/health` to carry `Authorization: Bearer
 * <token>` for a known Patient, and attaches that Patient as
 * `request.patient`. A missing header, a malformed one and an unknown token
 * all get the same 401, which does not say which it was.
 */
export function resolvePatients(app: FastifyInstance): void {
  app.decorateRequest("patient", null as unknown as Patient);

  app.addHook("onRequest", async (request) => {
    if (PUBLIC_URLS.has(request.routeOptions.url ?? "")) return;

    const patient = patientFor(request);
    if (!patient) throw httpError(401, "Unauthorized");
    request.patient = patient;
  });
}

function patientFor(request: FastifyRequest): Patient | undefined {
  const match = /^Bearer (\S+)$/.exec(request.headers.authorization ?? "");
  return match?.[1] === undefined ? undefined : PATIENTS_BY_TOKEN.get(match[1]);
}

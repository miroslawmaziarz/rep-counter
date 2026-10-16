import { patients, type Patient } from "@rep-counter/core";
import type { FastifyInstance } from "fastify";
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
 * Requires every request to a route but `/health` to carry `Authorization:
 * Bearer <token>` for a known Patient, and attaches that Patient as
 * `request.patient`. A missing header, a malformed one and an unknown token
 * all get the same 401, which does not say which it was. A request to no
 * route is let through, so it is a 404 with or without a token.
 */
export function resolvePatients(app: FastifyInstance): void {
  app.decorateRequest("patient", null as unknown as Patient);

  app.addHook("onRequest", async (request) => {
    const url = request.routeOptions.url;
    if (url === undefined || PUBLIC_URLS.has(url)) return;

    const patient = patientFor(request.headers.authorization);
    if (!patient) throw httpError(401, "Unauthorized");
    request.patient = patient;
  });
}

/**
 * The Patient whose token an `Authorization: Bearer <token>` header carries,
 * or `undefined` for a missing header, a malformed one or an unknown token,
 * which it does not tell apart.
 */
export function patientFor(
  authorization: string | undefined,
): Patient | undefined {
  const match = /^Bearer (\S+)$/.exec(authorization ?? "");
  return match?.[1] === undefined ? undefined : PATIENTS_BY_TOKEN.get(match[1]);
}

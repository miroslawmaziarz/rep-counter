import { patients, type Patient } from "@rep-counter/core";

const PATIENTS_BY_TOKEN = new Map(
  patients.map((patient) => [patient.token, patient]),
);

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

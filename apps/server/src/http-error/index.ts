/**
 * An error Fastify answers with `statusCode` and its standard error body
 * (`{ statusCode, error, message }`) when a hook or handler throws it.
 */
export function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

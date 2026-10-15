declare const sessionResultBrand: unique symbol;

/**
 * What is kept about a Session. Only `parseSessionResult` makes one, so
 * holding a `SessionResult` means it was validated and `performedAt` is the
 * UTC ISO form (`…Z`).
 */
export type SessionResult = {
  /** The Session it belongs to: 1 to 128 characters. */
  readonly sessionId: string;
  /** The Rep count: an integer, 0 or more. */
  readonly reps: number;
  /** How long the Session lasted, in seconds: more than 0, decimals allowed. */
  readonly durationSec: number;
  /** When the Session was performed, as UTC ISO 8601 (`…Z`). */
  readonly performedAt: string;
} & { readonly [sessionResultBrand]: true };

/** A valid Session Result, or every problem that stops a value being one. */
export type ParsedSessionResult =
  | { ok: true; sessionResult: SessionResult }
  | { ok: false; problems: string[] };

/**
 * Checks that a value from outside (a request body, a stored row) is a
 * Session Result, and normalises `performedAt` to UTC. Never throws.
 */
export function parseSessionResult(value: unknown): ParsedSessionResult {
  const fields = value as Record<string, unknown>;
  return {
    ok: true,
    sessionResult: {
      sessionId: fields.sessionId,
      reps: fields.reps,
      durationSec: fields.durationSec,
      performedAt: new Date(fields.performedAt as string).toISOString(),
    } as unknown as SessionResult,
  };
}

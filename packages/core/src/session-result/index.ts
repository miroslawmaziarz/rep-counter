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
 * Session Result, and normalises `performedAt` to UTC. Never throws: a
 * refusal lists every problem found, each naming its field.
 */
export function parseSessionResult(value: unknown): ParsedSessionResult {
  const fields = value as Record<string, unknown>;
  const problems = Object.entries(FIELD_RULES).flatMap(([field, rule]) =>
    rule.isValid(fields[field]) ? [] : [`${field} ${rule.requirement}`],
  );
  if (problems.length > 0) return { ok: false, problems };
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

type FieldRule = {
  /** Follows the field's name in a problem: "reps must be …". */
  requirement: string;
  isValid: (value: unknown) => boolean;
};

const FIELD_RULES: Record<string, FieldRule> = {
  sessionId: {
    requirement: "must be a string of 1 to 128 characters",
    isValid: (value) =>
      typeof value === "string" && value.length >= 1 && value.length <= 128,
  },
  reps: {
    requirement: "must be an integer ≥ 0",
    isValid: (value) => Number.isInteger(value) && (value as number) >= 0,
  },
  durationSec: {
    requirement: "must be a finite number > 0",
    isValid: (value) => Number.isFinite(value) && (value as number) > 0,
  },
};

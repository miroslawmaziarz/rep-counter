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
 * refusal lists every problem found, each naming its field. A value that is
 * not a plain object (an array, `null`, a string) has no fields to name, so
 * it gets one problem of its own.
 */
export function parseSessionResult(value: unknown): ParsedSessionResult {
  if (!isPlainObject(value)) {
    return { ok: false, problems: ["a Session Result must be an object"] };
  }
  const problems = [
    ...Object.entries(FIELD_RULES).flatMap(([field, rule]) =>
      rule.isValid(value[field]) ? [] : [`${field} ${rule.requirement}`],
    ),
    ...Object.keys(value)
      .filter((field) => !Object.hasOwn(FIELD_RULES, field))
      .map((field) => `${field} is not a Session Result field`),
  ];
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    sessionResult: {
      sessionId: value.sessionId,
      reps: value.reps,
      durationSec: value.durationSec,
      performedAt: new Date(value.performedAt as string).toISOString(),
    } as unknown as SessionResult,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

type FieldRule = {
  /** Follows the field's name in a problem: "reps must be …". */
  requirement: string;
  isValid: (value: unknown) => boolean;
};

/** The longest sessionId, in Unicode code points. */
const SESSION_ID_MAX_LENGTH = 128;

const FIELD_RULES: Record<string, FieldRule> = {
  sessionId: {
    requirement: `must be a string of 1 to ${SESSION_ID_MAX_LENGTH} characters`,
    // Counts Unicode code points, as the server's JSON Schema `maxLength`
    // does, so an emoji is one character, not two UTF-16 units.
    isValid: (value) =>
      typeof value === "string" &&
      value.length >= 1 &&
      [...value].length <= SESSION_ID_MAX_LENGTH,
  },
  reps: {
    requirement: "must be an integer ≥ 0",
    isValid: (value) => Number.isInteger(value) && (value as number) >= 0,
  },
  durationSec: {
    requirement: "must be a finite number > 0",
    isValid: (value) => Number.isFinite(value) && (value as number) > 0,
  },
  performedAt: {
    requirement:
      "must be an RFC 3339 date-time with a Z or ±HH:MM offset, e.g. 2026-10-14T09:30:00.000Z",
    isValid: isStrictDateTime,
  },
};

/**
 * Strict RFC 3339, the subset `new Date()` parses exactly: uppercase `T` and
 * `Z`, seconds below 60 (a Date cannot hold a leap second), at most
 * millisecond precision, and an offset of `Z` or `±HH:MM`.
 */
const DATE_TIME =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?<offsetHour>\d{2}):(?<offsetMinute>\d{2}))$/;

/** Matches `DATE_TIME`, then refuses the dates and times no calendar has. */
function isStrictDateTime(value: unknown): boolean {
  const match = typeof value === "string" ? DATE_TIME.exec(value) : null;
  if (!match) return false;
  // A `Z` offset leaves the offset groups empty, which reads as 0.
  const part = (name: string) => Number(match.groups?.[name] ?? 0);
  const month = part("month");
  const day = part("day");
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(part("year"), month) &&
    part("hour") <= 23 &&
    part("minute") <= 59 &&
    part("offsetHour") <= 23 &&
    part("offsetMinute") <= 59
  );
}

function daysInMonth(year: number, month: number): number {
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ]!;
}

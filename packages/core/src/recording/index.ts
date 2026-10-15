declare const recordingBrand: unique symbol;

/**
 * The Knee Angle of every frame of a Session, captured at a fixed sample
 * rate. Only `parseRecording` makes one, so holding a `Recording` means it
 * was validated.
 */
export type Recording = {
  /** Frames per second: a finite number, more than 0. */
  readonly sampleRateHz: number;
  /** The Knee Angle of each frame, in degrees: at least one, all finite. */
  readonly angles: readonly number[];
  /** The Rep count a labelled Recording, such as a Fixture, should produce. */
  readonly expectedReps?: number;
} & { readonly [recordingBrand]: true };

/** A valid Recording, or every problem that stops a value being one. */
export type ParsedRecording =
  | { ok: true; recording: Recording }
  | { ok: false; problems: string[] };

/**
 * Checks that a value from outside (a picked file's parsed JSON) is a
 * Recording. Never throws: a refusal lists every problem found, each naming
 * its field. A value that is not a plain object (an array, `null`, a string)
 * has no fields to name, so it gets one problem of its own.
 *
 * Other fields, such as a Fixture's `description`, are allowed and dropped.
 * `expectedReps` is kept when it is an integer ≥ 0 and dropped otherwise: it
 * labels a Recording but no rule reads it, so it never refuses one.
 */
export function parseRecording(value: unknown): ParsedRecording {
  if (!isPlainObject(value)) {
    return { ok: false, problems: ["a Recording must be an object"] };
  }
  const problems = Object.entries(FIELD_RULES).flatMap(([field, rule]) =>
    rule.isValid(value[field]) ? [] : [`${field} ${rule.requirement}`],
  );
  if (problems.length > 0) return { ok: false, problems };
  // No problems: every rule passed.
  const { sampleRateHz, angles } = value as RecordingFields;
  const { expectedReps } = value;
  return {
    ok: true,
    recording: {
      sampleRateHz,
      angles,
      ...(isRepCount(expectedReps) && { expectedReps }),
    } as Recording,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function isRepCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

type FieldRule = {
  /** Follows the field's name in a problem: "angles must be …". */
  requirement: string;
  isValid: (value: unknown) => boolean;
};

/** The fields a Recording must have, without the brand only the parser adds. */
type RecordingFields = Pick<Recording, "sampleRateHz" | "angles">;

/** One rule per required field, so a missing one fails to compile. */
const FIELD_RULES: { readonly [Field in keyof RecordingFields]: FieldRule } = {
  sampleRateHz: {
    requirement: "must be a finite number > 0",
    isValid: (value) => Number.isFinite(value) && (value as number) > 0,
  },
  angles: {
    requirement: "must be a non-empty array of finite numbers",
    isValid: (value) =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((angle) => Number.isFinite(angle)),
  },
};

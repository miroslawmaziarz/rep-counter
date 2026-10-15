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
 * Recording. Never throws.
 */
export function parseRecording(value: unknown): ParsedRecording {
  const fields = value as {
    sampleRateHz: number;
    angles: number[];
    expectedReps?: number;
  };
  return {
    ok: true,
    recording: {
      sampleRateHz: fields.sampleRateHz,
      angles: fields.angles,
      expectedReps: fields.expectedReps,
    } as Recording,
  };
}

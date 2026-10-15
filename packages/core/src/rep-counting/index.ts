/** The Knee Angles, in degrees, that define a Rep. */
export type RepThresholds = {
  /** A frame strictly below this arms a Rep. The brief's value is 100°. */
  deepBelow: number;
  /** A frame strictly above this completes an armed Rep. The brief's value is 160°. */
  standingAbove: number;
};

const BRIEF_THRESHOLDS: RepThresholds = { deepBelow: 100, standingAbove: 160 };

/**
 * Counts the Reps in a Recording: the Knee Angle goes strictly below
 * `deepBelow`, then comes back strictly above `standingAbove`. Any threshold
 * left out keeps the brief's value.
 *
 * The gap between the two thresholds is the hysteresis that absorbs noise:
 * dipping below `deepBelow` again before standing up does not start a second
 * Rep. A Recording that starts deep counts its first Rep; one that ends deep
 * gets no credit for the last. Input is trusted, not validated: `NaN` frames
 * satisfy neither threshold, so they are skipped.
 */
export function countReps(
  angles: readonly number[],
  thresholds: Partial<RepThresholds> = {},
): number {
  const { deepBelow, standingAbove } = { ...BRIEF_THRESHOLDS, ...thresholds };
  let reps = 0;
  let armed = false;
  for (const angle of angles) {
    if (angle < deepBelow) {
      armed = true;
    } else if (armed && angle > standingAbove) {
      reps += 1;
      armed = false;
    }
  }
  return reps;
}

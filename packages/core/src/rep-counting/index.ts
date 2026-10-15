/**
 * Counts the Reps in a Recording: the Knee Angle goes strictly below 100°,
 * then comes back strictly above 160°.
 *
 * The gap between the two thresholds is the hysteresis that absorbs noise:
 * dipping below 100° again before standing up does not start a second Rep.
 */
export function countReps(angles: readonly number[]): number {
  let reps = 0;
  let armed = false;
  for (const angle of angles) {
    if (angle < 100) {
      armed = true;
    } else if (armed && angle > 160) {
      reps += 1;
      armed = false;
    }
  }
  return reps;
}

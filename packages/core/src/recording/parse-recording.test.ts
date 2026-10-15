import { describe, expect, it } from "vitest";
import { parseRecording } from "../index";
import clean from "../../fixtures/session-clean.json";
import noisy from "../../fixtures/session-noisy.json";
import shallow from "../../fixtures/session-shallow.json";

describe("parseRecording on the Fixtures", () => {
  it.each([
    ["clean", clean],
    ["noisy", noisy],
    ["shallow", shallow],
  ])("accepts the %s Fixture and keeps its expectedReps", (_name, fixture) => {
    expect(parseRecording(fixture)).toEqual({
      ok: true,
      recording: {
        sampleRateHz: 30,
        angles: fixture.angles,
        expectedReps: fixture.expectedReps,
      },
    });
  });
});

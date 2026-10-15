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

const recording = { sampleRateHz: 30, angles: [172, 90, 172] };

describe("parseRecording on a valid Recording", () => {
  it("accepts one without expectedReps", () => {
    expect(parseRecording(recording)).toEqual({ ok: true, recording });
  });

  it("accepts a single frame and a fractional sample rate", () => {
    const value = { sampleRateHz: 29.97, angles: [172] };

    expect(parseRecording(value)).toEqual({ ok: true, recording: value });
  });

  it("ignores extra fields such as description", () => {
    expect(
      parseRecording({ ...recording, description: "One squat.", note: 1 }),
    ).toEqual({ ok: true, recording });
  });

  it("keeps an expectedReps of 0", () => {
    expect(parseRecording({ ...recording, expectedReps: 0 })).toEqual({
      ok: true,
      recording: { ...recording, expectedReps: 0 },
    });
  });

  it.each([-1, 1.5, "3", null])(
    "drops an expectedReps of %j instead of refusing the Recording",
    (expectedReps) => {
      expect(parseRecording({ ...recording, expectedReps })).toEqual({
        ok: true,
        recording,
      });
    },
  );
});

describe("parseRecording refuses", () => {
  it.each<[string, unknown]>([
    ["missing", undefined],
    ["0", 0],
    ["negative", -30],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["a numeric string", "30"],
  ])("a sampleRateHz that is %s", (_case, sampleRateHz) => {
    expect(parseRecording({ ...recording, sampleRateHz })).toEqual({
      ok: false,
      problems: ["sampleRateHz must be a finite number > 0"],
    });
  });

  it.each<[string, unknown]>([
    ["missing", undefined],
    ["empty", []],
    ["not an array", "172,90,172"],
    ["holding a string frame", [172, "90", 172]],
    ["holding a null frame", [172, null, 172]],
    ["holding a NaN frame", [172, NaN, 172]],
    ["holding an Infinity frame", [172, -Infinity, 172]],
  ])("angles %s", (_case, angles) => {
    expect(parseRecording({ ...recording, angles })).toEqual({
      ok: false,
      problems: ["angles must be a non-empty array of finite numbers"],
    });
  });

  it("every bad field together", () => {
    expect(parseRecording({ sampleRateHz: 0, angles: [] })).toEqual({
      ok: false,
      problems: [
        "sampleRateHz must be a finite number > 0",
        "angles must be a non-empty array of finite numbers",
      ],
    });
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["an array", [172, 90, 172]],
    ["a string", '{"sampleRateHz":30}'],
    ["a number", 30],
    ["undefined", undefined],
  ])("%s, which is not an object", (_case, value) => {
    expect(parseRecording(value)).toEqual({
      ok: false,
      problems: ["a Recording must be an object"],
    });
  });
});

import { describe, expect, it } from "vitest";
import { parseRecording, sessionResultOf, type Recording } from "../index";
import clean from "../../fixtures/session-clean.json";
import noisy from "../../fixtures/session-noisy.json";
import shallow from "../../fixtures/session-shallow.json";

const session = {
  sessionId: "session-1",
  performedAt: "2026-10-14T09:30:00.000Z",
};

function recordingOf(value: unknown): Recording {
  const parsed = parseRecording(value);
  if (!parsed.ok) throw new Error(parsed.problems.join("; "));
  return parsed.recording;
}

describe("sessionResultOf on the Fixtures", () => {
  // Durations worked out by hand: frames / 30 Hz.
  it.each([
    ["clean", clean, 10, 1088 / 30],
    ["noisy", noisy, 8, 27.6],
    ["shallow", shallow, 7, 36],
  ])(
    "gives the %s Fixture its labelled Reps and the length of its whole Recording",
    (_name, fixture, reps, durationSec) => {
      const sessionResult = sessionResultOf(recordingOf(fixture), session);

      expect(sessionResult).toEqual({
        ...session,
        reps,
        durationSec: expect.closeTo(durationSec, 9) as number,
      });
    },
  );
});

describe("sessionResultOf on hand-written Recordings", () => {
  it("takes 300 frames at 30 Hz as 10 seconds, however many Reps they hold", () => {
    const angles = [...Array<number>(299).fill(172), 90];

    expect(
      sessionResultOf(recordingOf({ sampleRateHz: 30, angles }), session),
    ).toEqual({ ...session, reps: 0, durationSec: 10 });
  });

  it("makes a Session Result with 0 Reps from a Recording with none", () => {
    const recording = recordingOf({
      sampleRateHz: 10,
      angles: [172, 120, 172],
    });

    expect(sessionResultOf(recording, session)).toEqual({
      ...session,
      reps: 0,
      durationSec: 0.3,
    });
  });

  it("normalises performedAt to UTC, as every Session Result does", () => {
    const recording = recordingOf({ sampleRateHz: 1, angles: [172, 90, 172] });

    expect(
      sessionResultOf(recording, {
        sessionId: "session-1",
        performedAt: "2026-10-14T11:30:00+02:00",
      }),
    ).toEqual({ ...session, reps: 1, durationSec: 3 });
  });

  it("throws when the caller's sessionId or performedAt is not valid", () => {
    const recording = recordingOf({ sampleRateHz: 30, angles: [172] });

    expect(() =>
      sessionResultOf(recording, { sessionId: "", performedAt: "yesterday" }),
    ).toThrow(/sessionId must be .*; performedAt must be/);
  });
});

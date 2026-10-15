import { describe, expect, it } from "vitest";
import { parseSessionResult, type SessionResult } from "../index";

const sessionResult = {
  sessionId: "session-1",
  reps: 12,
  durationSec: 45.5,
  performedAt: "2026-10-14T09:30:00.000Z",
};

describe("parseSessionResult on a valid Session Result", () => {
  it("returns it unchanged when performedAt is already UTC", () => {
    expect(parseSessionResult(sessionResult)).toEqual({
      ok: true,
      sessionResult,
    });
  });

  it("normalises performedAt to the same instant in UTC", () => {
    const parsed = parseSessionResult({
      ...sessionResult,
      performedAt: "2026-10-14T11:30:00+02:00",
    });

    expect(parsed).toEqual({ ok: true, sessionResult });
  });
});

describe("SessionResult", () => {
  it("is only made by parseSessionResult, not by an object literal", () => {
    // @ts-expect-error A plain object is not a validated Session Result.
    const unchecked: SessionResult = { ...sessionResult };

    expect(unchecked).toEqual(sessionResult);
  });
});

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

  it.each<[string, typeof sessionResult]>([
    ["reps is 0", { ...sessionResult, reps: 0 }],
    [
      "sessionId is 128 chars",
      { ...sessionResult, sessionId: "s".repeat(128) },
    ],
    ["durationSec is a fraction", { ...sessionResult, durationSec: 0.25 }],
    [
      "performedAt is in the future",
      { ...sessionResult, performedAt: "2099-01-01T00:00:00.000Z" },
    ],
  ])("accepts it when %s", (_, accepted) => {
    expect(parseSessionResult(accepted)).toEqual({
      ok: true,
      sessionResult: accepted,
    });
  });
});

describe("SessionResult", () => {
  it("is only made by parseSessionResult, not by an object literal", () => {
    // @ts-expect-error A plain object is not a validated Session Result.
    const unchecked: SessionResult = { ...sessionResult };

    expect(unchecked).toEqual(sessionResult);
  });
});

const { sessionId, reps, durationSec, performedAt } = sessionResult;

/** Asserts a refusal with a problem that names `field`. */
function expectRefused(value: unknown, field: string) {
  const parsed = parseSessionResult(value);

  expect(parsed.ok).toBe(false);
  expect(parsed.ok ? [] : parsed.problems).toContainEqual(
    expect.stringContaining(field),
  );
}

describe("parseSessionResult refuses a bad field", () => {
  it.each<[string, unknown, string]>([
    ["sessionId is missing", { reps, durationSec, performedAt }, "sessionId"],
    ["sessionId is empty", { ...sessionResult, sessionId: "" }, "sessionId"],
    [
      "sessionId is over 128 chars",
      { ...sessionResult, sessionId: "s".repeat(129) },
      "sessionId",
    ],
    [
      "sessionId is not a string",
      { ...sessionResult, sessionId: 1 },
      "sessionId",
    ],
    ["reps is missing", { sessionId, durationSec, performedAt }, "reps"],
    ["reps is negative", { ...sessionResult, reps: -1 }, "reps"],
    ["reps is not an integer", { ...sessionResult, reps: 1.5 }, "reps"],
    ["reps is a numeric string", { ...sessionResult, reps: "12" }, "reps"],
    ["durationSec is missing", { sessionId, reps, performedAt }, "durationSec"],
    [
      "durationSec is zero",
      { ...sessionResult, durationSec: 0 },
      "durationSec",
    ],
    [
      "durationSec is negative",
      { ...sessionResult, durationSec: -1 },
      "durationSec",
    ],
    [
      "durationSec is a numeric string",
      { ...sessionResult, durationSec: "45" },
      "durationSec",
    ],
    [
      "durationSec is not finite",
      { ...sessionResult, durationSec: Infinity },
      "durationSec",
    ],
    ["performedAt is missing", { sessionId, reps, durationSec }, "performedAt"],
    [
      "performedAt is not a string",
      { ...sessionResult, performedAt: 0 },
      "performedAt",
    ],
    [
      "performedAt is not a date",
      { ...sessionResult, performedAt: "yesterday" },
      "performedAt",
    ],
    [
      "performedAt has no time",
      { ...sessionResult, performedAt: "2026-10-14" },
      "performedAt",
    ],
    [
      "performedAt has no offset",
      { ...sessionResult, performedAt: "2026-10-14T09:30:00" },
      "performedAt",
    ],
    [
      "performedAt has a +00 offset",
      { ...sessionResult, performedAt: "2026-10-14T09:30:00+00" },
      "performedAt",
    ],
    [
      "performedAt has a +0000 offset",
      { ...sessionResult, performedAt: "2026-10-14T09:30:00+0000" },
      "performedAt",
    ],
    [
      "performedAt has a space separator",
      { ...sessionResult, performedAt: "2026-10-14 09:30:00Z" },
      "performedAt",
    ],
    [
      "performedAt has a lowercase t",
      { ...sessionResult, performedAt: "2026-10-14t09:30:00Z" },
      "performedAt",
    ],
    [
      "performedAt has a lowercase z",
      { ...sessionResult, performedAt: "2026-10-14T09:30:00z" },
      "performedAt",
    ],
    [
      "performedAt has over 3 fractional digits",
      { ...sessionResult, performedAt: "2026-10-14T09:30:00.123456Z" },
      "performedAt",
    ],
    [
      "performedAt is a leap second",
      { ...sessionResult, performedAt: "2026-12-31T23:59:60Z" },
      "performedAt",
    ],
    [
      "performedAt is a day the month does not have",
      { ...sessionResult, performedAt: "2026-02-30T09:30:00Z" },
      "performedAt",
    ],
    [
      "performedAt is hour 24",
      { ...sessionResult, performedAt: "2026-10-14T24:00:00Z" },
      "performedAt",
    ],
    [
      "performedAt has an offset beyond 23:59",
      { ...sessionResult, performedAt: "2026-10-14T09:30:00+24:00" },
      "performedAt",
    ],
  ])("when %s", (_, value, field) => {
    expectRefused(value, field);
  });
});

describe("parseSessionResult refuses a value of the wrong shape", () => {
  it("when there is an extra field, naming it", () => {
    expectRefused({ ...sessionResult, patientId: "franek" }, "patientId");
  });

  it.each<[string, unknown]>([
    ["an array", [sessionResult]],
    ["null", null],
    ["a string", "session-1"],
    ["undefined", undefined],
  ])("when the value is %s", (_, value) => {
    expect(parseSessionResult(value)).toEqual({
      ok: false,
      problems: ["a Session Result must be an object"],
    });
  });
});

describe("parseSessionResult on a value with several problems", () => {
  it("reports each of them", () => {
    const parsed = parseSessionResult({
      sessionId: "",
      reps: -1,
      durationSec: "45",
      patientId: "franek",
    });

    expect(parsed).toEqual({
      ok: false,
      problems: [
        "sessionId must be a string of 1 to 128 characters",
        "reps must be an integer ≥ 0",
        "durationSec must be a finite number > 0",
        "performedAt must be an RFC 3339 date-time with a Z or ±HH:MM offset, e.g. 2026-10-14T09:30:00.000Z",
        "patientId is not a Session Result field",
      ],
    });
  });
});

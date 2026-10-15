import { describe, expect, it } from "vitest";
import { countReps } from "../index";
import clean from "../../fixtures/session-clean.json";
import noisy from "../../fixtures/session-noisy.json";
import shallow from "../../fixtures/session-shallow.json";

describe("countReps on the Fixtures", () => {
  it.each([
    ["clean", clean],
    ["noisy", noisy],
    ["shallow", shallow],
  ])("counts the %s Fixture's labelled Reps", (_name, fixture) => {
    expect(countReps(fixture.angles)).toBe(fixture.expectedReps);
  });
});

describe("countReps on hand-written Recordings", () => {
  it("counts a Rep that goes below 100° and back above 160°", () => {
    expect(countReps([172, 99, 161])).toBe(1);
  });

  it("does not arm a Rep at exactly 100°", () => {
    expect(countReps([172, 100, 172])).toBe(0);
  });

  it("does not complete a Rep at exactly 160°", () => {
    expect(countReps([172, 90, 160, 160])).toBe(0);
  });

  it("counts a Recording that starts deep and then stands", () => {
    expect(countReps([90, 130, 172])).toBe(1);
  });

  it("gives no credit for a Rep still deep when the Recording ends", () => {
    expect(countReps([172, 90, 172, 90, 130])).toBe(1);
  });

  it("counts once however often the angle crosses 100° before standing", () => {
    expect(countReps([172, 99, 101, 98, 120, 95, 172])).toBe(1);
  });

  it("gives 0 for an empty Recording", () => {
    expect(countReps([])).toBe(0);
  });

  it("skips NaN frames", () => {
    expect(countReps([172, NaN, 90, NaN, 172, NaN])).toBe(1);
  });
});

describe("countReps with RepThresholds", () => {
  it("counts the shallow Fixture's half-squats too when deepBelow is 140°", () => {
    expect(countReps(shallow.angles, { deepBelow: 140 })).toBe(10);
  });

  it("keeps standingAbove at 160° when only deepBelow is overridden", () => {
    expect(countReps([172, 120, 161], { deepBelow: 140 })).toBe(1);
    expect(countReps([172, 120, 160], { deepBelow: 140 })).toBe(0);
  });

  it("keeps deepBelow at 100° when only standingAbove is overridden", () => {
    expect(countReps([172, 99, 151], { standingAbove: 150 })).toBe(1);
    expect(countReps([172, 100, 172], { standingAbove: 150 })).toBe(0);
  });
});

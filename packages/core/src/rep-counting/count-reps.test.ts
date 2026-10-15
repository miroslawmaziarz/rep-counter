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

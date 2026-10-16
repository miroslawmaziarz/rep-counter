import { describe, expect, it } from "vitest";
import { patientFor } from ".";

describe("patientFor", () => {
  it.each([
    ["julia-token", "julia"],
    ["franek-token", "franek"],
  ])("finds the Patient whose token %s is in a Bearer header", (token, id) => {
    expect(patientFor(`Bearer ${token}`)?.id).toBe(id);
  });

  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["an unknown token", "Bearer stranger-token"],
    ["another scheme", "Basic julia-token"],
    ["a bare token", "julia-token"],
    ["a Bearer with no token", "Bearer "],
    ["a token followed by more", "Bearer julia-token extra"],
  ])("finds no Patient for %s", (_, authorization) => {
    expect(patientFor(authorization)).toBeUndefined();
  });
});

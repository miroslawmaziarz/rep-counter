import { patients } from "@rep-counter/core";
import { describe, expect, it } from "vitest";
import { patientFor } from ".";

const [{ token }] = patients;

describe("patientFor", () => {
  it.each(patients.map((patient) => [patient.name, patient] as const))(
    "finds %s from their token in a Bearer header",
    (_, patient) => {
      expect(patientFor(`Bearer ${patient.token}`)).toEqual(patient);
    },
  );

  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["an unknown token", "Bearer stranger-token"],
    ["another scheme", `Basic ${token}`],
    ["a bare token", token],
    ["a Bearer with no token", "Bearer "],
    ["a token followed by more", `Bearer ${token} extra`],
  ])("finds no Patient for %s", (_, authorization) => {
    expect(patientFor(authorization)).toBeUndefined();
  });
});

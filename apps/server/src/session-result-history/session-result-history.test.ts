import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { patients, type Patient } from "@rep-counter/core";
import { openSessionResultHistory, type SessionResult } from "./index";

const julia = patientNamed("Julia");
const franek = patientNamed("Franek");

function patientNamed(name: string): Patient {
  const patient = patients.find((candidate) => candidate.name === name);
  if (!patient) throw new Error(`No Patient named ${name}`);
  return patient;
}

const squats: SessionResult = {
  sessionId: "session-1",
  reps: 12,
  durationSec: 45.5,
  performedAt: "2026-10-14T09:30:00.000Z",
};

describe("Session Result history", () => {
  it("saves a Session Result and lists it for its Patient", () => {
    const history = openSessionResultHistory(":memory:");

    const saved = history.save(julia, squats);

    expect(saved).toEqual({ outcome: "saved", sessionResult: squats });
    expect(history.list(julia)).toEqual([squats]);
  });

  it("keeps an identical Resend once and hands back the stored Session Result", () => {
    const history = openSessionResultHistory(":memory:");
    history.save(julia, squats);

    const resent = history.save(julia, { ...squats });

    expect(resent).toEqual({ outcome: "resent", sessionResult: squats });
    expect(history.list(julia)).toEqual([squats]);
  });

  it.each<[string, Partial<SessionResult>]>([
    ["reps", { reps: 13 }],
    ["durationSec", { durationSec: 46 }],
    ["performedAt", { performedAt: "2026-10-14T09:31:00.000Z" }],
  ])(
    "refuses a Resend with different %s and keeps the original",
    (_, change) => {
      const history = openSessionResultHistory(":memory:");
      history.save(julia, squats);

      const resent = history.save(julia, { ...squats, ...change });

      expect(resent).toEqual({ outcome: "conflict", sessionResult: squats });
      expect(history.list(julia)).toEqual([squats]);
    },
  );

  it("keeps each Patient's sessionIds apart", () => {
    const history = openSessionResultHistory(":memory:");
    const franeks = { ...squats, reps: 3 };

    history.save(julia, squats);
    const saved = history.save(franek, franeks);

    expect(saved.outcome).toBe("saved");
    expect(history.list(julia)).toEqual([squats]);
    expect(history.list(franek)).toEqual([franeks]);
  });

  it("stores performedAt in UTC, so the same instant in another offset is an identical Resend", () => {
    const history = openSessionResultHistory(":memory:");

    const saved = history.save(julia, {
      ...squats,
      performedAt: "2026-10-14T11:30:00+02:00",
    });
    const resent = history.save(julia, {
      ...squats,
      performedAt: "2026-10-14T09:30:00+00:00",
    });

    expect(saved).toEqual({ outcome: "saved", sessionResult: squats });
    expect(resent).toEqual({ outcome: "resent", sessionResult: squats });
    expect(history.list(julia)).toEqual([squats]);
  });

  it("lists newest performedAt first, and same-instant Session Results in save order", () => {
    const history = openSessionResultHistory(":memory:");
    const at = (sessionId: string, performedAt: string) => ({
      ...squats,
      sessionId,
      performedAt,
    });
    const monday = at("monday", "2026-10-12T08:00:00.000Z");
    const wednesdayFirst = at("wednesday-1", "2026-10-14T08:00:00.000Z");
    const wednesdaySecond = at("wednesday-2", "2026-10-14T08:00:00.000Z");
    const tuesday = at("tuesday", "2026-10-13T08:00:00.000Z");

    for (const result of [monday, wednesdayFirst, wednesdaySecond, tuesday]) {
      history.save(julia, result);
    }

    expect(history.list(julia).map((r) => r.sessionId)).toEqual([
      "wednesday-1",
      "wednesday-2",
      "tuesday",
      "monday",
    ]);
  });

  it("keeps Session Results in a database file after it is closed and reopened", () => {
    const directory = mkdtempSync(join(tmpdir(), "rep-counter-"));
    onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
    const databasePath = join(directory, "history.sqlite");

    const before = openSessionResultHistory(databasePath);
    before.save(julia, squats);
    before.close();
    const after = openSessionResultHistory(databasePath);

    expect(after.list(julia)).toEqual([squats]);
    after.close();
  });

  it("creates the database file's missing directories", () => {
    const directory = mkdtempSync(join(tmpdir(), "rep-counter-"));
    onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
    const databasePath = join(directory, "not", "yet", "history.sqlite");

    const history = openSessionResultHistory(databasePath);
    history.save(julia, squats);

    expect(history.list(julia)).toEqual([squats]);
    history.close();
  });
});

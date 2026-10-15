import { describe, expect, it } from "vitest";
import { openSessionResultHistory, type SessionResult } from "./index";

const squats: SessionResult = {
  sessionId: "session-1",
  reps: 12,
  durationSec: 45.5,
  performedAt: "2026-10-14T09:30:00.000Z",
};

describe("Session Result history", () => {
  it("saves a Session Result and lists it for its Patient", () => {
    const history = openSessionResultHistory(":memory:");

    const saved = history.save("julia", squats);

    expect(saved).toEqual({ outcome: "saved", sessionResult: squats });
    expect(history.list("julia")).toEqual([squats]);
  });

  it("keeps an identical Resend once and hands back the stored Session Result", () => {
    const history = openSessionResultHistory(":memory:");
    history.save("julia", squats);

    const resent = history.save("julia", { ...squats });

    expect(resent).toEqual({ outcome: "resent", sessionResult: squats });
    expect(history.list("julia")).toEqual([squats]);
  });

  it.each<[string, Partial<SessionResult>]>([
    ["reps", { reps: 13 }],
    ["durationSec", { durationSec: 46 }],
    ["performedAt", { performedAt: "2026-10-14T09:31:00.000Z" }],
  ])(
    "refuses a Resend with different %s and keeps the original",
    (_, change) => {
      const history = openSessionResultHistory(":memory:");
      history.save("julia", squats);

      const resent = history.save("julia", { ...squats, ...change });

      expect(resent).toEqual({ outcome: "conflict", sessionResult: squats });
      expect(history.list("julia")).toEqual([squats]);
    },
  );

  it("keeps each Patient's sessionIds apart", () => {
    const history = openSessionResultHistory(":memory:");
    const franeks = { ...squats, reps: 3 };

    history.save("julia", squats);
    const saved = history.save("franek", franeks);

    expect(saved.outcome).toBe("saved");
    expect(history.list("julia")).toEqual([squats]);
    expect(history.list("franek")).toEqual([franeks]);
  });

  it("stores performedAt in UTC, so the same instant in another offset is an identical Resend", () => {
    const history = openSessionResultHistory(":memory:");

    const saved = history.save("julia", {
      ...squats,
      performedAt: "2026-10-14T11:30:00+02:00",
    });
    const resent = history.save("julia", {
      ...squats,
      performedAt: "2026-10-14T09:30:00+00:00",
    });

    expect(saved).toEqual({ outcome: "saved", sessionResult: squats });
    expect(resent).toEqual({ outcome: "resent", sessionResult: squats });
    expect(history.list("julia")).toEqual([squats]);
  });
});

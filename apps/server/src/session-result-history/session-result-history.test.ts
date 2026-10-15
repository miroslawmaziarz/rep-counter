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
});

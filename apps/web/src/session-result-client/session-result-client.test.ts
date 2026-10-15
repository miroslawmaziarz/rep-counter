import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionResultClient } from ".";

afterEach(() => {
  vi.unstubAllGlobals();
});

const juliasHistory = [
  {
    sessionId: "s-2",
    reps: 12,
    durationSec: 42.3,
    performedAt: "2026-10-14T09:30:00.000Z",
  },
  {
    sessionId: "s-1",
    reps: 0,
    durationSec: 5,
    performedAt: "2026-10-13T18:00:00.000Z",
  },
];

describe("listing a Patient's Session Results", () => {
  it("asks the API for the Patient's Session Results with their token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(juliasHistory));
    vi.stubGlobal("fetch", fetchMock);

    const listed = await sessionResultClient("julia-token").list();

    expect(listed).toEqual({ ok: true, sessionResults: juliasHistory });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sessions");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer julia-token",
    );
  });
});

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

  it("fails as a network failure when the request does not reach the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const listed = await sessionResultClient("julia-token").list();

    expect(listed).toEqual({ ok: false, failure: "network" });
  });

  it.each([401, 500, 502])(
    "fails as a server failure when the API answers %i",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(Response.json({ message: "nope" }, { status })),
      );

      const listed = await sessionResultClient("julia-token").list();

      expect(listed).toEqual({ ok: false, failure: "server" });
    },
  );

  it("returns each Session Result as core parses it, performedAt in UTC", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            sessionId: "s-1",
            reps: 3,
            durationSec: 9.5,
            performedAt: "2026-10-14T11:30:00+02:00",
          },
        ]),
      ),
    );

    const listed = await sessionResultClient("julia-token").list();

    expect(listed).toEqual({
      ok: true,
      sessionResults: [
        {
          sessionId: "s-1",
          reps: 3,
          durationSec: 9.5,
          performedAt: "2026-10-14T09:30:00.000Z",
        },
      ],
    });
  });

  it.each([
    ["an item is not a Session Result", [{ ...juliasHistory[0], reps: -1 }]],
    ["an item has an extra field", [{ ...juliasHistory[0], angles: [170] }]],
    ["the body is not a list", { sessions: juliasHistory }],
  ])("fails as malformed when %s", async (_, body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));

    const listed = await sessionResultClient("julia-token").list();

    expect(listed).toEqual({ ok: false, failure: "malformed" });
  });

  it("fails as malformed when the body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>oops</html>")),
    );

    const listed = await sessionResultClient("julia-token").list();

    expect(listed).toEqual({ ok: false, failure: "malformed" });
  });
});

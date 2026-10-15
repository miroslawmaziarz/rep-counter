import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSessionResult, type SessionResult } from "@rep-counter/core";
import { sessionResultClient } from ".";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  describe("a request the API does not answer", () => {
    /** A fetch that never answers, but rejects as fetch does once aborted. */
    const hangingFetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    /**
     * Fake timers do not reach the platform's own `AbortSignal.timeout`
     * clock, so it is rebuilt on the faked `setTimeout`.
     */
    function useFakeClock() {
      vi.useFakeTimers();
      vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
        const controller = new AbortController();
        setTimeout(
          () =>
            controller.abort(
              new DOMException("signal timed out", "TimeoutError"),
            ),
          ms,
        );
        return controller.signal;
      });
    }

    it("is still waiting just under 10 s", async () => {
      useFakeClock();
      vi.stubGlobal("fetch", hangingFetch);

      let settled = false;
      void sessionResultClient("julia-token")
        .list()
        .then(() => (settled = true));
      await vi.advanceTimersByTimeAsync(9_999);

      expect(settled).toBe(false);
    });

    it("fails as a network failure after 10 s", async () => {
      useFakeClock();
      vi.stubGlobal("fetch", hangingFetch);

      const listing = sessionResultClient("julia-token").list();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(await listing).toEqual({ ok: false, failure: "network" });
    });
  });
});

/** A Session Result as core makes it, so `save` can be called with one. */
function sessionResult(value: unknown): SessionResult {
  const parsed = parseSessionResult(value);
  if (!parsed.ok) throw new Error(parsed.problems.join("; "));
  return parsed.sessionResult;
}

const todaysSession = sessionResult({
  sessionId: "s-3",
  reps: 10,
  durationSec: 36.3,
  performedAt: "2026-10-15T08:00:00.000Z",
});

describe("saving a Session Result", () => {
  it("posts the Session Result as JSON with the Patient's token, and is saved on 201", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json(todaysSession, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const saved = await sessionResultClient("julia-token").save(todaysSession);

    expect(saved).toBe("saved");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sessions");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer julia-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      sessionId: "s-3",
      reps: 10,
      durationSec: 36.3,
      performedAt: "2026-10-15T08:00:00.000Z",
    });
  });
});

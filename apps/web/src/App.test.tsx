import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
});

const juliasHistory = [
  {
    sessionId: "julia-2",
    reps: 12,
    durationSec: 42.3,
    performedAt: "2026-10-14T09:30:00.000Z",
  },
  {
    sessionId: "julia-1",
    reps: 0,
    durationSec: 5,
    performedAt: "2026-10-13T06:05:00.000Z",
  },
];

/** The table's body rows, each as its cells' text. */
function historyRows() {
  const table = screen.getByRole("table", { name: "Session history" });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );
}

describe("a Patient's Session history", () => {
  it("lists Julia's Session Results by default, newest first", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(juliasHistory));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await screen.findByRole("table", { name: "Session history" });
    // Performed is shown in local time: the tests run in Europe/Warsaw.
    expect(historyRows()).toEqual([
      [expect.stringContaining("11:30"), "12", "42.3 s"],
      [expect.stringContaining("8:05"), "0", "5.0 s"],
    ]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer julia-token",
    );
  });

  it("shows the history is loading until the API answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<App />);

    expect(await screen.findByText("Loading Sessions…")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says there are no Sessions yet when the history is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));

    render(<App />);

    expect(await screen.findByText("No Sessions yet")).toBeInTheDocument();
    expect(screen.queryByText("Loading Sessions…")).not.toBeInTheDocument();
  });

  it.each([
    [
      "the API cannot be reached",
      () => Promise.reject(new TypeError("Failed to fetch")),
    ],
    [
      "the API answers with an error",
      () => Promise.resolve(new Response(null, { status: 502 })),
    ],
    [
      "the response is malformed",
      () =>
        Promise.resolve(Response.json([{ ...juliasHistory[0], reps: "12" }])),
    ],
  ])("shows an error when %s", async (_, answer) => {
    vi.stubGlobal("fetch", vi.fn(answer));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load the Session history",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading Sessions…")).not.toBeInTheDocument();
  });
});

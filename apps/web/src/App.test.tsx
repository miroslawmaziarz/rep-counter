import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  vi.useRealTimers();
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

const franeksHistory = [
  {
    sessionId: "franek-1",
    reps: 7,
    durationSec: 20,
    performedAt: "2026-10-12T07:00:00.000Z",
  },
];

/** The token a request carried in its Authorization header. */
function tokenOf(init: RequestInit | undefined) {
  return new Headers(init?.headers)
    .get("Authorization")
    ?.replace("Bearer ", "");
}

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
    expect(tokenOf(fetchMock.mock.calls[0]?.[1])).toBe("julia-token");
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

  it("offers Julia and Franek, with Julia chosen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));

    render(<App />);

    const selector = screen.getByRole("combobox", { name: "Patient" });
    expect(selector).toHaveDisplayValue("Julia");
    expect(
      within(selector)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Julia", "Franek"]);
    await screen.findByText("No Sessions yet");
  });

  it("shows only Franek's history once he is chosen, sending his token", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        Response.json(
          tokenOf(init) === "franek-token" ? franeksHistory : juliasHistory,
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("table", { name: "Session history" });

    fireEvent.change(screen.getByRole("combobox", { name: "Patient" }), {
      target: { value: "franek" },
    });

    expect(await screen.findByText("20.0 s")).toBeInTheDocument();
    expect(historyRows()).toEqual([
      [expect.stringContaining("9:00"), "7", "20.0 s"],
    ]);
    expect(tokenOf(fetchMock.mock.calls.at(-1)?.[1])).toBe("franek-token");
  });

  it("keeps showing Franek's history when Julia's arrives after it", async () => {
    let answerJulia: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        tokenOf(init) === "franek-token"
          ? Promise.resolve(Response.json(franeksHistory))
          : new Promise<Response>((resolve) => (answerJulia = resolve)),
      ),
    );
    render(<App />);
    fireEvent.change(screen.getByRole("combobox", { name: "Patient" }), {
      target: { value: "franek" },
    });
    await screen.findByRole("table", { name: "Session history" });

    await act(async () => answerJulia(Response.json(juliasHistory)));

    expect(historyRows()).toEqual([
      [expect.stringContaining("9:00"), "7", "20.0 s"],
    ]);
  });

  it("shows Franek's history as loading while only Julia's has arrived", async () => {
    let answerJulia: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        tokenOf(init) === "franek-token"
          ? new Promise<Response>(() => {})
          : new Promise<Response>((resolve) => (answerJulia = resolve)),
      ),
    );
    render(<App />);
    fireEvent.change(screen.getByRole("combobox", { name: "Patient" }), {
      target: { value: "franek" },
    });

    await act(async () => answerJulia(Response.json(juliasHistory)));

    expect(screen.getByText("Loading Sessions…")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

/** A Fixture's file as the README tells a Patient to pick it. */
const cleanFixture = readFileSync(
  join(
    import.meta.dirname,
    "../../../packages/core/fixtures/session-clean.json",
  ),
  "utf8",
);

/** Feeds a file to the Recording input, as picking it in the browser does. */
function pickRecording(contents: string, name = "session-clean.json") {
  fireEvent.change(screen.getByLabelText("Recording"), {
    target: {
      files: [new File([contents], name, { type: "application/json" })],
    },
  });
}

/** The value shown for a term of the counted Session, such as "Reps". */
function counted(term: string) {
  return screen.getByText(term, { selector: "dt" }).nextElementSibling
    ?.textContent;
}

type Route = (init: RequestInit) => Promise<Response>;

/**
 * A fetch that answers a listing with `history` and a save with `save`,
 * recording every request it gets.
 */
function stubApi({
  history = () => Promise.resolve(Response.json([])),
  save = () => Promise.resolve(Response.json({}, { status: 201 })),
}: { history?: Route; save?: Route } = {}) {
  const fetchMock = vi.fn((_url: string, init: RequestInit = {}) =>
    init.method === "POST" ? save(init) : history(init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return {
    fetchMock,
    /** The bodies of every save, parsed. */
    savedBodies: () =>
      fetchMock.mock.calls
        .filter(([, init]) => init?.method === "POST")
        .map(([, init]) => JSON.parse(init?.body as string) as unknown),
  };
}

describe("counting a picked Recording and saving its Session Result", () => {
  it("shows a Fixture's Reps, duration and expected Reps, and saves only its Session Result", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T08:00:00.000Z"));
    const api = stubApi();
    render(<App />);

    pickRecording(cleanFixture);

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(counted("Reps")).toBe("10 (expected 10)");
    expect(counted("Duration")).toBe("36.3 s");
    const [body] = api.savedBodies();
    expect(body).toEqual({
      sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      reps: 10,
      durationSec: 1088 / 30,
      performedAt: "2026-10-15T08:00:00.000Z",
    });
    const [url, init] = api.fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST",
    )!;
    expect(url).toBe("/api/sessions");
    expect(tokenOf(init)).toBe("julia-token");
  });

  it("says a file that is not JSON cannot be read, and sends nothing", async () => {
    const api = stubApi();
    render(<App />);
    await screen.findByText("No Sessions yet");

    pickRecording("not json", "notes.txt");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "notes.txt is not a JSON file",
    );
    expect(api.savedBodies()).toEqual([]);
  });

  it("lists what stops a file being a Recording, and sends nothing", async () => {
    const api = stubApi();
    render(<App />);
    await screen.findByText("No Sessions yet");

    pickRecording(JSON.stringify({ sampleRateHz: 0, angles: [] }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("session-clean.json is not a Recording");
    expect(
      within(alert)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "sampleRateHz must be a finite number > 0",
      "angles must be a non-empty array of finite numbers",
    ]);
    expect(
      screen.queryByText("Reps", { selector: "dt" }),
    ).not.toBeInTheDocument();
    expect(api.savedBodies()).toEqual([]);
  });

  it("shows a failed save as not saved, and Retry resends the same Session Result until it is saved", async () => {
    const answers = [
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => Promise.resolve(new Response(null, { status: 503 })),
      () => Promise.resolve(Response.json({}, { status: 200 })),
    ];
    let listings = 0;
    const api = stubApi({
      history: () => {
        listings += 1;
        return Promise.resolve(
          Response.json(listings > 1 ? juliasHistory : []),
        );
      },
      save: () => answers.shift()!(),
    });
    render(<App />);
    await screen.findByText("No Sessions yet");
    pickRecording(cleanFixture);

    expect(await screen.findByRole("alert")).toHaveTextContent("Not saved");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Not saved");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    const [first, ...resends] = api.savedBodies();
    expect(resends).toEqual([first, first]);
    expect(
      await screen.findByRole("table", { name: "Session history" }),
    ).toBeInTheDocument();
  });

  it("disables Retry while a send is in flight", async () => {
    let answerRetry: (response: Response) => void = () => {};
    const answers = [
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => new Promise<Response>((resolve) => (answerRetry = resolve)),
    ];
    const api = stubApi({ save: () => answers.shift()!() });
    render(<App />);
    pickRecording(cleanFixture);
    const retry = await screen.findByRole("button", { name: "Retry" });

    fireEvent.click(retry);

    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(api.savedBodies()).toHaveLength(2);
    await act(async () => answerRetry(Response.json({}, { status: 201 })));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("says a conflicting Session Result was refused, with no Retry", async () => {
    stubApi({
      save: () =>
        Promise.resolve(
          Response.json({ message: "conflict" }, { status: 409 }),
        ),
    });
    render(<App />);

    pickRecording(cleanFixture);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Not saved: this Session was already saved with different values.",
    );
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  it("makes a new Session each time the same file is picked", async () => {
    const api = stubApi();
    render(<App />);

    pickRecording(cleanFixture);
    await screen.findByText("Saved");
    pickRecording(cleanFixture);
    await waitFor(() => expect(api.savedBodies()).toHaveLength(2));

    const [first, second] = api.savedBodies() as { sessionId: string }[];
    expect(first!.sessionId).not.toBe(second!.sessionId);
  });

  it("discards the current Session when another Patient is chosen, so Retry cannot save it for them", async () => {
    const api = stubApi({
      save: () => Promise.reject(new TypeError("Failed to fetch")),
    });
    render(<App />);
    pickRecording(cleanFixture);
    await screen.findByRole("button", { name: "Retry" });

    fireEvent.change(screen.getByRole("combobox", { name: "Patient" }), {
      target: { value: "franek" },
    });

    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Reps", { selector: "dt" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await screen.findByText("No Sessions yet");
    expect(api.savedBodies()).toHaveLength(1);
  });

  it("drops a save's answer that arrives after another Patient is chosen", async () => {
    let answerSave: (response: Response) => void = () => {};
    stubApi({
      save: () => new Promise<Response>((resolve) => (answerSave = resolve)),
    });
    render(<App />);
    pickRecording(cleanFixture);
    await screen.findByText("Saving…");
    fireEvent.change(screen.getByRole("combobox", { name: "Patient" }), {
      target: { value: "franek" },
    });

    await act(async () => answerSave(new Response(null, { status: 503 })));

    expect(screen.queryByText("Not saved.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Reps", { selector: "dt" }),
    ).not.toBeInTheDocument();
  });

  it("drops a pick whose file is still being read when another Patient is chosen", async () => {
    const api = stubApi();
    render(<App />);

    pickRecording(cleanFixture);
    fireEvent.change(screen.getByRole("combobox", { name: "Patient" }), {
      target: { value: "franek" },
    });
    await screen.findByText("No Sessions yet");
    await act(async () => {});

    expect(
      screen.queryByText("Reps", { selector: "dt" }),
    ).not.toBeInTheDocument();
    expect(api.savedBodies()).toEqual([]);
  });
});

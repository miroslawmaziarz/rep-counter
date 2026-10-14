import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("API health on the placeholder page", () => {
  it("shows the API is ok when /api/health answers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("API: ok")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/health");
  });

  it("shows the API is unreachable when the proxy cannot reach the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 502 })),
    );

    render(<App />);

    expect(await screen.findByText("API: unreachable")).toBeInTheDocument();
  });

  it("shows the API is unreachable when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    render(<App />);

    expect(await screen.findByText("API: unreachable")).toBeInTheDocument();
  });

  it("recovers once the server comes up after the page loads", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValue(Response.json({ status: "ok" })),
    );

    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText("API: unreachable")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.getByText("API: ok")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
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
});

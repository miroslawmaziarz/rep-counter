import { describe, expect, it } from "vitest";
import { buildApp } from "./app";

describe("GET /health", () => {
  it("reports the API is ok", async () => {
    const app = buildApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("GET /sessions", () => {
  it.each(["julia-token", "franek-token"])(
    "lists no Session Results for the Patient with token %s",
    async (token) => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/sessions",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    },
  );
});

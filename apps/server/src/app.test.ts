import { describe, expect, it } from "vitest";
import { buildApp } from "./app";

describe("GET /health", () => {
  it("reports the API is ok without a token", async () => {
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

  it("refuses a caller who is not a Patient with one 401 that does not say why", async () => {
    const app = buildApp();
    const attempts: Record<string, string>[] = [
      {},
      { authorization: "Basic julia-token" },
      { authorization: "Bearer" },
      { authorization: "Bearer stranger-token" },
    ];

    const responses = await Promise.all(
      attempts.map((headers) =>
        app.inject({ method: "GET", url: "/sessions", headers }),
      ),
    );

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        statusCode: 401,
        error: "Unauthorized",
      });
    }
    const bodies = new Set(responses.map((response) => response.body));
    expect(bodies.size).toBe(1);
  });
});

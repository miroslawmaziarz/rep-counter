import type { FastifyInstance } from "fastify";
import { describe, expect, it, onTestFinished } from "vitest";
import { buildApp } from "./app";

const JULIA = "julia-token";
const FRANEK = "franek-token";

const squats = {
  sessionId: "session-1",
  reps: 12,
  durationSec: 45.5,
  performedAt: "2026-10-14T09:30:00.000Z",
};

function testApp(): FastifyInstance {
  const app = buildApp({ databasePath: ":memory:" });
  onTestFinished(() => app.close());
  return app;
}

function post(app: FastifyInstance, token: string, payload: unknown) {
  return app.inject({
    method: "POST",
    url: "/sessions",
    headers: { authorization: `Bearer ${token}` },
    payload: payload as object,
  });
}

function list(app: FastifyInstance, token: string) {
  return app.inject({
    method: "GET",
    url: "/sessions",
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("GET /health", () => {
  it("reports the API is ok without a token", async () => {
    const app = testApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("GET /sessions", () => {
  it.each([JULIA, FRANEK])(
    "lists no Session Results for the Patient with token %s",
    async (token) => {
      const app = testApp();

      const response = await list(app, token);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    },
  );

  it("refuses a caller who is not a Patient with one 401 that does not say why", async () => {
    const app = testApp();
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

describe("POST /sessions", () => {
  it("saves a Session Result and returns it with 201", async () => {
    const app = testApp();

    const response = await post(app, JULIA, squats);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(squats);
    expect((await list(app, JULIA)).json()).toEqual([squats]);
  });

  it("answers an identical Resend with 200 and the stored Session Result, and keeps it once", async () => {
    const app = testApp();
    await post(app, JULIA, squats);

    const response = await post(app, JULIA, squats);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(squats);
    expect((await list(app, JULIA)).json()).toEqual([squats]);
  });

  it("treats performedAt in +00:00 and Z for the same instant as an identical Resend", async () => {
    const app = testApp();
    await post(app, JULIA, {
      ...squats,
      performedAt: "2026-10-14T09:30:00+00:00",
    });

    const response = await post(app, JULIA, squats);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(squats);
  });

  it("refuses a conflicting Resend with 409 and keeps the original values", async () => {
    const app = testApp();
    await post(app, JULIA, squats);

    const response = await post(app, JULIA, { ...squats, reps: 13 });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ statusCode: 409 });
    expect((await list(app, JULIA)).json()).toEqual([squats]);
  });

  it("lets Julia and Franek each save the same sessionId and see only their own", async () => {
    const app = testApp();
    const franeks = { ...squats, reps: 3 };

    const julias = await post(app, JULIA, squats);
    const franekResponse = await post(app, FRANEK, franeks);

    expect(julias.statusCode).toBe(201);
    expect(franekResponse.statusCode).toBe(201);
    expect((await list(app, JULIA)).json()).toEqual([squats]);
    expect((await list(app, FRANEK)).json()).toEqual([franeks]);
  });

  it("refuses a caller who is not a Patient with 401", async () => {
    const app = testApp();

    const response = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: squats,
    });

    expect(response.statusCode).toBe(401);
    expect((await list(app, JULIA)).json()).toEqual([]);
  });
});

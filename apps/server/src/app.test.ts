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

  it("lists only the caller's Session Results, newest performedAt first", async () => {
    const app = testApp();
    const older = { ...squats, sessionId: "older" };
    const newer = {
      ...squats,
      sessionId: "newer",
      performedAt: "2026-10-15T07:00:00.000Z",
    };
    await post(app, JULIA, older);
    await post(app, JULIA, newer);
    await post(app, FRANEK, { ...squats, sessionId: "franeks" });

    const response = await list(app, JULIA);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([newer, older]);
  });

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

  const { sessionId, reps, durationSec, performedAt } = squats;
  it.each<[string, unknown]>([
    ["sessionId is missing", { reps, durationSec, performedAt }],
    ["sessionId is empty", { ...squats, sessionId: "" }],
    ["sessionId is over 128 chars", { ...squats, sessionId: "s".repeat(129) }],
    ["sessionId is not a string", { ...squats, sessionId: 1 }],
    ["reps is missing", { sessionId, durationSec, performedAt }],
    ["reps is negative", { ...squats, reps: -1 }],
    ["reps is not an integer", { ...squats, reps: 1.5 }],
    ["reps is a numeric string", { ...squats, reps: "12" }],
    ["durationSec is missing", { sessionId, reps, performedAt }],
    ["durationSec is zero", { ...squats, durationSec: 0 }],
    ["durationSec is negative", { ...squats, durationSec: -1 }],
    ["durationSec is a numeric string", { ...squats, durationSec: "45" }],
    ["performedAt is missing", { sessionId, reps, durationSec }],
    ["performedAt is not a date", { ...squats, performedAt: "yesterday" }],
    ["performedAt has no time", { ...squats, performedAt: "2026-10-14" }],
    [
      "performedAt has no offset",
      { ...squats, performedAt: "2026-10-14T09:30:00" },
    ],
    [
      "performedAt has a +00 offset",
      { ...squats, performedAt: "2026-10-14T09:30:00+00" },
    ],
    [
      "performedAt has a +0000 offset",
      { ...squats, performedAt: "2026-10-14T09:30:00+0000" },
    ],
    [
      "performedAt has a space separator",
      { ...squats, performedAt: "2026-10-14 09:30:00Z" },
    ],
    [
      "performedAt has a lowercase t",
      { ...squats, performedAt: "2026-10-14t09:30:00Z" },
    ],
    [
      "performedAt has a lowercase z",
      { ...squats, performedAt: "2026-10-14T09:30:00z" },
    ],
    [
      "performedAt has over 3 fractional digits",
      { ...squats, performedAt: "2026-10-14T09:30:00.123456Z" },
    ],
    [
      "performedAt is a leap second",
      { ...squats, performedAt: "2026-12-31T23:59:60Z" },
    ],
    ["there is an extra field", { ...squats, patientId: "franek" }],
    ["the body is an array", [squats]],
  ])("refuses with 400 and saves nothing when %s", async (_, payload) => {
    const app = testApp();

    const response = await post(app, JULIA, payload);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect((await list(app, JULIA)).json()).toEqual([]);
  });

  it.each<[string, typeof squats]>([
    ["reps is 0", { ...squats, reps: 0 }],
    ["sessionId is 128 chars", { ...squats, sessionId: "s".repeat(128) }],
    ["durationSec is a fraction", { ...squats, durationSec: 0.25 }],
    [
      "performedAt is in the future",
      { ...squats, performedAt: "2099-01-01T00:00:00.000Z" },
    ],
  ])("saves a Session Result when %s", async (_, sessionResult) => {
    const app = testApp();

    const response = await post(app, JULIA, sessionResult);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(sessionResult);
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

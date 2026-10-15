import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { patients } from "@rep-counter/core";
import type { FastifyInstance } from "fastify";
import { describe, expect, it, onTestFinished } from "vitest";
import { buildApp } from "./app";

const JULIA = tokenOf("Julia");
const FRANEK = tokenOf("Franek");

function tokenOf(name: string): string {
  const patient = patients.find((candidate) => candidate.name === name);
  if (!patient) throw new Error(`No Patient named ${name}`);
  return patient.token;
}

const sessionResult = {
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
    const older = { ...sessionResult, sessionId: "older" };
    const newer = {
      ...sessionResult,
      sessionId: "newer",
      performedAt: "2026-10-15T07:00:00.000Z",
    };
    await post(app, JULIA, older);
    await post(app, JULIA, newer);
    await post(app, FRANEK, { ...sessionResult, sessionId: "franeks" });

    const response = await list(app, JULIA);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([newer, older]);
  });

  it("refuses a caller who is not a Patient with one 401 that does not say why", async () => {
    const app = testApp();
    const attempts: Record<string, string>[] = [
      {},
      { authorization: `Basic ${JULIA}` },
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

    const response = await post(app, JULIA, sessionResult);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(sessionResult);
    expect((await list(app, JULIA)).json()).toEqual([sessionResult]);
  });

  it("answers an identical Resend with 200 and the stored Session Result, and keeps it once", async () => {
    const app = testApp();
    await post(app, JULIA, sessionResult);

    const response = await post(app, JULIA, sessionResult);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(sessionResult);
    expect((await list(app, JULIA)).json()).toEqual([sessionResult]);
  });

  it("treats performedAt in +00:00 and Z for the same instant as an identical Resend", async () => {
    const app = testApp();
    await post(app, JULIA, {
      ...sessionResult,
      performedAt: "2026-10-14T09:30:00+00:00",
    });

    const response = await post(app, JULIA, sessionResult);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(sessionResult);
  });

  it("refuses a conflicting Resend with 409 and keeps the original values", async () => {
    const app = testApp();
    await post(app, JULIA, sessionResult);

    const response = await post(app, JULIA, { ...sessionResult, reps: 13 });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ statusCode: 409 });
    expect((await list(app, JULIA)).json()).toEqual([sessionResult]);
  });

  it("lets Julia and Franek each save the same sessionId and see only their own", async () => {
    const app = testApp();
    const franeks = { ...sessionResult, reps: 3 };

    const julias = await post(app, JULIA, sessionResult);
    const franekResponse = await post(app, FRANEK, franeks);

    expect(julias.statusCode).toBe(201);
    expect(franekResponse.statusCode).toBe(201);
    expect((await list(app, JULIA)).json()).toEqual([sessionResult]);
    expect((await list(app, FRANEK)).json()).toEqual([franeks]);
  });

  it("refuses an invalid Session Result with 400 naming the field, and saves nothing", async () => {
    const app = testApp();

    const response = await post(app, JULIA, { ...sessionResult, reps: -1 });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: "reps must be an integer ≥ 0",
    });
    expect((await list(app, JULIA)).json()).toEqual([]);
  });

  it("refuses a caller who is not a Patient with 401", async () => {
    const app = testApp();

    const response = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: sessionResult,
    });

    expect(response.statusCode).toBe(401);
    expect((await list(app, JULIA)).json()).toEqual([]);
  });
});

describe("the database file", () => {
  it("keeps a Session Result after the app is closed and rebuilt on the same path", async () => {
    const directory = mkdtempSync(join(tmpdir(), "rep-counter-"));
    onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
    const databasePath = join(directory, "session-results.sqlite");

    const before = buildApp({ databasePath });
    await post(before, JULIA, sessionResult);
    await before.close();
    const after = buildApp({ databasePath });
    onTestFinished(() => after.close());

    expect((await list(after, JULIA)).json()).toEqual([sessionResult]);
  });
});

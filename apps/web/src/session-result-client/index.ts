import { parseSessionResult, type SessionResult } from "@rep-counter/core";

/**
 * Why a request failed: `network` means it never got an answer from the
 * API; `server` means the API answered with an error status; `malformed`
 * means the answer was not what the API promises.
 */
export type Failure = "network" | "server" | "malformed";

/** A Patient's Session Results, newest first, or why they could not be listed. */
export type ListedSessionResults =
  | { ok: true; sessionResults: SessionResult[] }
  | { ok: false; failure: Failure };

/**
 * What became of a Session Result sent to the API: `saved` covers both a
 * first save and an identical Resend; `conflict` means the Patient already
 * saved different values under its `sessionId`; a Failure means it may not
 * have been saved, and sending the same Session Result again is safe.
 */
export type SaveOutcome = "saved" | "conflict" | Failure;

/** Talks to the API on behalf of one Patient, identified by their token. */
export type SessionResultClient = {
  /**
   * The Patient's Session Results, newest first. Every item is checked by
   * core's `parseSessionResult`; one bad item makes the whole list malformed.
   */
  list(): Promise<ListedSessionResults>;
  /** Saves a Session Result in the Patient's history. Never throws. */
  save(sessionResult: SessionResult): Promise<SaveOutcome>;
};

export function sessionResultClient(token: string): SessionResultClient {
  return {
    async list() {
      const sent = await send("/sessions", token);
      if (!sent.ok) return sent;
      if (!sent.response.ok) return { ok: false, failure: "server" };
      const answer = await readJson(sent.response);
      if (!answer.ok) return answer;
      if (!Array.isArray(answer.body)) return MALFORMED;
      const sessionResults: SessionResult[] = [];
      for (const item of answer.body) {
        const parsed = parseSessionResult(item);
        if (!parsed.ok) return MALFORMED;
        sessionResults.push(parsed.sessionResult);
      }
      return { ok: true, sessionResults };
    },

    async save(sessionResult) {
      const sent = await send("/sessions", token, {
        method: "POST",
        body: JSON.stringify(sessionResult),
      });
      if (!sent.ok) return sent.failure;
      return "saved";
    },
  };
}

const MALFORMED = { ok: false, failure: "malformed" } as const;

/** How long a request may take, body included, before it is a network failure. */
const TIMEOUT_MS = 10_000;

/**
 * Sends one request to the API, a JSON body when there is one, under the
 * timeout. Never throws: a request that gets no answer is a network failure.
 */
async function send(
  path: string,
  token: string,
  { method = "GET", body }: { method?: string; body?: string } = {},
): Promise<
  { ok: true; response: Response } | { ok: false; failure: "network" }
> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(`/api${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { ok: true, response };
  } catch {
    return { ok: false, failure: "network" };
  }
}

/** Reads a response's JSON body; one cut off by the timeout is a network failure. */
async function readJson(
  response: Response,
): Promise<{ ok: true; body: unknown } | { ok: false; failure: Failure }> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { ok: false, failure: "network" };
  }
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return MALFORMED;
  }
}

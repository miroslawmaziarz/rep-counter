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

/** Talks to the API on behalf of one Patient, identified by their token. */
export type SessionResultClient = {
  /**
   * The Patient's Session Results, newest first. Every item is checked by
   * core's `parseSessionResult`; one bad item makes the whole list malformed.
   */
  list(): Promise<ListedSessionResults>;
};

export function sessionResultClient(token: string): SessionResultClient {
  return {
    async list() {
      const answer = await request("/sessions", token);
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
  };
}

const MALFORMED = { ok: false, failure: "malformed" } as const;

type Answer = { ok: true; body: unknown } | { ok: false; failure: Failure };

/** How long a request may take, body included, before it is a network failure. */
const TIMEOUT_MS = 10_000;

/** Sends one request to the API and reads its JSON body. Never throws. */
async function request(path: string, token: string): Promise<Answer> {
  let text: string;
  try {
    const response = await fetch(`/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, failure: "server" };
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

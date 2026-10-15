import type { SessionResult } from "@rep-counter/core";

/**
 * Why a request failed: `network` means it never got an answer from the
 * API; `server` means the API answered with an error status.
 */
export type Failure = "network" | "server";

/** A Patient's Session Results, newest first, or why they could not be listed. */
export type ListedSessionResults =
  | { ok: true; sessionResults: SessionResult[] }
  | { ok: false; failure: Failure };

/** Talks to the API on behalf of one Patient, identified by their token. */
export type SessionResultClient = {
  list(): Promise<ListedSessionResults>;
};

export function sessionResultClient(token: string): SessionResultClient {
  return {
    async list() {
      let response: Response;
      try {
        response = await fetch("/api/sessions", {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        return { ok: false, failure: "network" };
      }
      if (!response.ok) return { ok: false, failure: "server" };
      return {
        ok: true,
        sessionResults: (await response.json()) as SessionResult[],
      };
    },
  };
}

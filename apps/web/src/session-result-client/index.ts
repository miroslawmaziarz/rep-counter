import type { SessionResult } from "@rep-counter/core";

/** A Patient's Session Results, newest first, or why they could not be listed. */
export type ListedSessionResults = {
  ok: true;
  sessionResults: SessionResult[];
};

/** Talks to the API on behalf of one Patient, identified by their token. */
export type SessionResultClient = {
  list(): Promise<ListedSessionResults>;
};

export function sessionResultClient(token: string): SessionResultClient {
  return {
    async list() {
      const response = await fetch("/api/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        ok: true,
        sessionResults: (await response.json()) as SessionResult[],
      };
    },
  };
}

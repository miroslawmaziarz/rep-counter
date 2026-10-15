import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkPr } from "./pr-scope.js";

describe("checkPr", () => {
  it("scopes a PR that changes one workspace plus root files to that workspace", () => {
    const result = checkPr("server: Save a Session Result", [
      "apps/server/src/app.ts",
      "package-lock.json",
      "docs/architecture.md",
    ]);

    assert.deepEqual(result, { scope: "server", problems: [] });
  });
});

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

  it("scopes a PR that changes only root files to repo", () => {
    const result = checkPr("repo: Scope PR titles", [
      ".github/workflows/ci.yml",
      "AGENTS.md",
    ]);

    assert.deepEqual(result, { scope: "repo", problems: [] });
  });

  it("refuses a PR that changes more than one workspace, naming each", () => {
    const result = checkPr("core: List the Patients", [
      "packages/core/src/patients/index.ts",
      "apps/server/src/app.ts",
      "apps/web/src/App.tsx",
    ]);

    assert.equal(result.scope, null);
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0], /core, server, web/);
  });

  it("refuses a title whose scope isn't the one the files give", () => {
    const result = checkPr("core: Save a Session Result", [
      "apps/server/src/app.ts",
    ]);

    assert.equal(result.scope, "server");
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0], /server: /);
  });

  for (const title of [
    "server, web: Save a Session Result",
    "Save a Session Result",
    "server: save a Session Result",
    "server:Save a Session Result",
    "server - Save a Session Result",
    "server: ",
  ]) {
    it(`refuses the title '${title}'`, () => {
      const result = checkPr(title, ["apps/server/src/app.ts"]);

      assert.equal(result.problems.length, 1);
    });
  }
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scopePr, labelEdits } from "./pr-scope.js";

const WORKSPACES = ["packages/core", "apps/server", "apps/web"];

describe("scopePr", () => {
  it("scopes a PR that changes one workspace plus root files to that workspace", () => {
    const result = scopePr(
      "server: Save a Session Result",
      ["apps/server/src/app.ts", "package-lock.json", "docs/architecture.md"],
      WORKSPACES,
    );

    assert.deepEqual(result, { scope: "server", problems: [] });
  });

  it("scopes a PR that changes only root files to repo", () => {
    const result = scopePr(
      "repo: Scope PR titles",
      [".github/workflows/ci.yml", "AGENTS.md"],
      WORKSPACES,
    );

    assert.deepEqual(result, { scope: "repo", problems: [] });
  });

  it("refuses a PR that changes more than one workspace, naming each", () => {
    const result = scopePr(
      "core: List the Patients",
      [
        "packages/core/src/patients/index.ts",
        "apps/server/src/app.ts",
        "apps/web/src/App.tsx",
      ],
      WORKSPACES,
    );

    assert.equal(result.scope, null);
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0], /core, server, web/);
  });

  it("refuses a title whose scope isn't the one the files give", () => {
    const result = scopePr(
      "core: Save a Session Result",
      ["apps/server/src/app.ts"],
      WORKSPACES,
    );

    assert.equal(result.scope, "server");
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0], /server: /);
  });

  it("scopes a PR to a new workspace by its folder name", () => {
    const result = scopePr(
      "mobile: Count Reps on the phone",
      ["apps/mobile/src/app.ts"],
      [...WORKSPACES, "apps/mobile"],
    );

    assert.deepEqual(result, { scope: "mobile", problems: [] });
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
      const result = scopePr(title, ["apps/server/src/app.ts"], WORKSPACES);

      assert.equal(result.problems.length, 1);
    });
  }
});

describe("labelEdits", () => {
  it("adds the scope's label and removes every other scope label", () => {
    const edits = labelEdits("server", [
      "scope:core",
      "scope:web",
      "ready-for-human",
    ]);

    assert.deepEqual(edits, {
      add: ["scope:server"],
      remove: ["scope:core", "scope:web"],
    });
  });

  it("leaves a label that is already right", () => {
    const edits = labelEdits("repo", ["scope:repo"]);

    assert.deepEqual(edits, { add: [], remove: [] });
  });

  it("removes every scope label when the PR has no scope", () => {
    const edits = labelEdits(null, ["scope:core", "scope:server"]);

    assert.deepEqual(edits, {
      add: [],
      remove: ["scope:core", "scope:server"],
    });
  });
});

// Works out a PR's one scope from its changed files, checks its title against
// it and, given a PR number, sets the matching scope:* label. See "One scope
// per PR" in AGENTS.md.
//
//   npm run pr-scope -- "<title>" [--base <ref>] [--pr <number>]
//
// The changed files are `git diff <base>...HEAD`, so a stacked PR is scoped
// against its own base. --base defaults to origin/main.

import { execFileSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const WORKSPACES = {
  core: "packages/core/",
  server: "apps/server/",
  web: "apps/web/",
};

const LABEL_PREFIX = "scope:";

/**
 * @param {string} title
 * @param {string[]} files paths changed by the PR, relative to the repo root
 * @returns {{ scope: string | null, problems: string[] }}
 */
export function checkPr(title, files) {
  const workspaces = Object.entries(WORKSPACES)
    .filter(([, dir]) => files.some((file) => file.startsWith(dir)))
    .map(([name]) => name);
  if (workspaces.length > 1) {
    return {
      scope: null,
      problems: [
        `The PR changes ${workspaces.length} workspaces (${workspaces.join(", ")}); ` +
          "a PR may change only one. Split it with expand-contract (AGENTS.md).",
      ],
    };
  }
  const scope = workspaces[0] ?? "repo";
  const problems = new RegExp(`^${scope}: [A-Z]`).test(title)
    ? []
    : [`Expected the title to be '${scope}: <Sentence>'; got '${title}'.`];
  return { scope, problems };
}

/**
 * The label changes that leave a PR with only its scope's label.
 *
 * @param {string | null} scope null when the PR has no single scope
 * @param {string[]} labels the PR's current labels
 * @returns {{ add: string[], remove: string[] }}
 */
export function labelEdits(scope, labels) {
  const wanted = scope === null ? null : `${LABEL_PREFIX}${scope}`;
  return {
    add: wanted === null || labels.includes(wanted) ? [] : [wanted],
    remove: labels.filter(
      (label) => label.startsWith(LABEL_PREFIX) && label !== wanted,
    ),
  };
}

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" });
}

function lines(text) {
  return text.split("\n").filter(Boolean);
}

function syncLabels(pr, scope) {
  const labels = lines(
    run("gh", ["pr", "view", pr, "--json", "labels", "--jq", ".labels[].name"]),
  );
  const { add, remove } = labelEdits(scope, labels);
  // The REST API creates a label that doesn't exist yet; `gh pr edit` doesn't.
  for (const label of add) {
    run("gh", [
      "api",
      "--method",
      "POST",
      `repos/{owner}/{repo}/issues/${pr}/labels`,
      "-f",
      `labels[]=${label}`,
    ]);
  }
  for (const label of remove) {
    run("gh", [
      "api",
      "--method",
      "DELETE",
      `repos/{owner}/{repo}/issues/${pr}/labels/${encodeURIComponent(label)}`,
    ]);
  }
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: "string", default: "origin/main" },
      pr: { type: "string" },
    },
  });
  const [title] = positionals;
  if (title === undefined || positionals.length > 1) {
    process.stderr.write(
      'Usage: npm run pr-scope -- "<title>" [--base <ref>] [--pr <number>]\n',
    );
    return 2;
  }

  const files = lines(
    run("git", ["diff", "--name-only", `${values.base}...HEAD`]),
  );
  const { scope, problems } = checkPr(title, files);
  if (values.pr !== undefined) syncLabels(values.pr, scope);

  const errorPrefix = process.env.GITHUB_ACTIONS ? "::error::" : "";
  for (const problem of problems) {
    process.stderr.write(`${errorPrefix}${problem}\n`);
  }
  if (problems.length > 0) return 1;
  process.stdout.write(`Scope: ${scope}\n`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main();
}

// Works out a PR's one scope from its changed files and checks its title
// against it. See "One scope per PR" in AGENTS.md.

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

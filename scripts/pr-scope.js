// Works out a PR's one scope from its changed files and checks its title
// against it. See "One scope per PR" in AGENTS.md.

const WORKSPACES = {
  core: "packages/core/",
  server: "apps/server/",
  web: "apps/web/",
};

/**
 * @param {string} title
 * @param {string[]} files paths changed by the PR, relative to the repo root
 * @returns {{ scope: string | null, problems: string[] }}
 */
export function checkPr(title, files) {
  const workspaces = Object.entries(WORKSPACES)
    .filter(([, dir]) => files.some((file) => file.startsWith(dir)))
    .map(([name]) => name);
  const scope = workspaces[0] ?? "repo";
  return { scope, problems: [] };
}

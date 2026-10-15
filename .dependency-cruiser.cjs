// Enforces the dependency rules in docs/architecture.md.
// A module is a folder directly under a package's src/; its index.ts is its interface.
const MODULE_INTERNAL = "^(?:packages|apps)/[^/]+/src/[^/]+/(?!index\\.tsx?$)";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular imports blur which module owns what.",
      from: {},
      to: { circular: true },
    },
    {
      name: "core-is-pure",
      severity: "error",
      comment:
        "core runs identically in the browser and in Vitest: no Node APIs, frameworks or apps (ADR 0001).",
      from: { path: "^packages/core/" },
      to: {
        pathNot: "^packages/core/",
        dependencyTypesNot: ["npm-dev"],
      },
    },
    {
      name: "server-and-web-only-talk-over-http",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" },
    },
    {
      name: "packages-only-through-exports",
      severity: "error",
      comment:
        "Import a package by its name; its exports map is its interface.",
      from: { pathNot: "^packages/core/" },
      to: {
        path: "^packages/core/",
        pathNot: "^packages/core/src/index\\.ts$",
      },
    },
    {
      name: "modules-only-through-index",
      severity: "error",
      comment:
        "Reach another module only through its index.ts; the rest of its folder is internal.",
      from: { path: "^((?:packages|apps)/[^/]+/src/[^/]+)/" },
      to: { path: MODULE_INTERNAL, pathNot: "^$1/" },
    },
    {
      name: "modules-only-through-index-from-package-root",
      severity: "error",
      comment: "Same rule, for files sitting directly in src/.",
      from: { path: "^(?:packages|apps)/[^/]+/src/[^/]+\\.tsx?$" },
      to: { path: MODULE_INTERNAL },
    },
    {
      name: "no-undeclared-dependencies",
      severity: "error",
      comment:
        "npm hoists every dependency; import only what this workspace's package.json declares.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    combinedDependencies: true,
    doNotFollow: { path: "node_modules" },
    exclude: { path: "\\.config\\.[cm]?[jt]s$" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "types", "default"],
      extensions: [".ts", ".tsx", ".js"],
      mainFields: ["module", "main", "types"],
    },
  },
};

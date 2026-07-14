# Artie-Lens

[![npm version](https://img.shields.io/npm/v/artie-lens.svg)](https://www.npmjs.com/package/artie-lens)
[![CI](https://github.com/ariusxi/artie-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/ariusxi/artie-lens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A CLI that measures **object-oriented design quality** in TypeScript projects using the
Chidamber & Kemerer (CK) metrics suite. Every metric is computed **per class**, from the
TypeScript AST, and reported with a threshold label and an actionable hint.

## Requirements

- **Node.js ≥ 20** to run the CLI (development requires Node 22 — see [.nvmrc](./.nvmrc))
- A TypeScript project (the analyzer reads `.ts` source files)

## Installation

```bash
# Global install (recommended for CLI use)
npm install -g artie-lens
```

Local development against this repository:

```bash
git clone https://github.com/ariusxi/artie-lens.git
cd artie-lens
yarn install
yarn build
npm link   # makes the `artie` CLI available globally
```

## Quick start

```bash
artie init          # create a .artierc.json in the current directory
artie run           # analyze the current directory
artie run ./packages/api   # analyze a specific directory
artie help          # list available commands
```

## The metrics

### Class metrics (CK suite)

Measured **per class**, following _A Metrics Suite for Object Oriented Design_
(Chidamber & Kemerer, IEEE TSE, 1994). Higher values mean higher complexity/risk.

| Metric | Name | What it measures | High value suggests |
| --- | --- | --- | --- |
| **WMC** | Weighted Methods per Class | Sum of the cyclomatic complexity of each method (constructors, accessors and arrow-function fields included). With trivial methods it equals the method count. | Class is doing too much; hard to test/maintain. |
| **DIT** | Depth of Inheritance Tree | Length of the `extends` chain from the class up to the root (a root class is `0`). | Behavior is harder to predict; many inherited methods. |
| **NOC** | Number of Children | Number of **immediate** subclasses (direct children only, not deeper descendants). | Possible misuse of subclassing or a leaky base abstraction. |
| **CBO** | Coupling Between Object classes | Number of **other classes** this class depends on — via heritage, parameter/property/return types, and usages inside method bodies (`new`, calls, member access). | Fragile design; changes elsewhere ripple in. |
| **RFC** | Response For a Class | Size of the response set: the class's own methods **plus** the first-level methods they call. | Testing/debugging is harder (many methods can run per message). |
| **LCOM** | Lack of Cohesion in Methods | Pairs of methods that share **no** instance variable, minus the pairs that do (floored at 0). `0` when methods are cohesive or use no instance state. | Class mixes unrelated responsibilities; consider splitting (SRP). |

### Module metrics

Measured **per module** (file), so they apply to any TypeScript, including functional code
with no classes. Reported value is the module path.

| Metric | Name | What it measures | High value suggests |
| --- | --- | --- | --- |
| **CE** | Efferent Coupling | Number of distinct project modules this file imports (via `import` and `export ... from`). | Module is fragile to upstream changes; a coupling hub. |
| **CYCLIC** | Circular dependency | Size of the import cycle the module belongs to (`0` when acyclic). | Import cycle: hard to test, build, and reason about. |

### Scope & known limitations

- **CBO** is **efferent** (fan-out) only — it counts what a class depends on, not what
  depends on it — and it does **not** count coupling to `interface`s (only concrete classes).
- **WMC** uses cyclomatic complexity as the per-method weight (a legitimate reading of the
  paper, which leaves the weight open). Static methods are included.
- **RFC** counts the first level of method calls only (as in the paper) and excludes calls
  to library/`node_modules`/declaration-file functions (e.g. `console.log`).
- **LCOM** excludes static methods, counts constructor **parameter properties** as instance
  variables, and does not track destructuring access (`const { x } = this`).
- **DIT** follows the `extends` chain and counts every ancestor class it can resolve,
  including external base classes when they are declared as classes in available typings.
- **NOC** counts immediate subclasses found **within the analyzed project** only.
- **CE** and **CYCLIC** resolve relative imports within the analyzed project. Path aliases
  from `tsconfig` (e.g. `@/foo`) are not resolved yet, so imports through aliases are not
  counted. External (`node_modules`) imports are ignored by design.

## Configuration

`artie init` writes a `.artierc.json` at the project root:

```json
{
  "options": {
    "defaultThresholds": {
      "warning": 10,
      "critical": 20,
      "levels": ["OK", "WARNING", "CRITICAL"]
    },
    "metrics": {
      "lcom": { "enabled": true, "warning": 5, "critical": 10 },
      "wmc": { "enabled": true, "warning": 10, "critical": 25 },
      "rfc": { "enabled": true, "warning": 15, "critical": 30 },
      "cbo": { "enabled": true },
      "dit": { "enabled": true, "warning": 4, "critical": 6 },
      "noc": { "enabled": true, "warning": 10, "critical": 20 },
      "ce": { "enabled": true, "warning": 8, "critical": 15 },
      "cyclic": { "enabled": true, "warning": 1, "critical": 1 }
    }
  },
  "includes": ["**/*.ts", "!**/*.d.ts"],
  "excludes": ["**/*.test.ts", "node_modules", "dist", "scripts/**"]
}
```

| Field | Meaning |
| --- | --- |
| `metrics.<name>.enabled` | Whether the metric runs. |
| `metrics.<name>.warning` / `critical` | Per-metric thresholds. **If omitted, the metric inherits `defaultThresholds`** (e.g. `cbo` above uses `warning: 10`, `critical: 20`). |
| `options.defaultThresholds.levels` | **Display filter** — only classes whose label is in this list are printed. Keep `"OK"` to show everything; drop it to show only problems. |
| `includes` / `excludes` | [fast-glob](https://github.com/mrmlnc/fast-glob) patterns, resolved relative to the analyzed directory. **Note the plural keys.** |

A class is labelled by comparing its metric value against the thresholds:

- `value >= critical` → **CRITICAL**
- `value >= warning` → **WARNING**
- otherwise → **OK**

## Example output

```text
📊 WMC Metrics:
- Total: 42
- Average: 7.00
- Maximum: 25
- Minimum: 1
- Standard Deviation: 8.31

Files:
[CRITICAL] UserService → 25
   💡 High complexity → difficult to test and maintain. Suggestion: refactor into smaller methods or delegate responsibilities to services.
[WARNING] OrderMapper → 12
   💡 Complexity is increasing → consider extracting helper methods or simplifying logic.
```

## Programmatic use

The metric functions are exported and can be used directly. Each returns
`{ total, label, value }[]` (one entry per class):

```ts
import { calculateWMC } from 'artie-lens'

const results = await calculateWMC(
  process.cwd(),
  { enabled: true, warning: 10, critical: 25, levels: ['OK', 'WARNING', 'CRITICAL'] },
  ['**/*.ts', '!**/*.d.ts'],
  ['**/*.test.ts', 'node_modules'],
)

console.log(results) // [{ total: 25, label: 'CRITICAL', value: 'UserService' }, ...]
```

`calculateCBO`, `calculateRFC` and `calculateLCOM` share the same signature.

## Commands

| Command | Description |
| --- | --- |
| `artie init` | Create a `.artierc.json` with default settings (no-op if it already exists). |
| `artie run [dir]` | Analyze `dir` (default: current directory) using `.artierc.json`. |
| `artie help` | List available commands. |

### Options for `run`

| Option | Description |
| --- | --- |
| `--json` | Print the full report as JSON (metrics, per-class summary, regressions, and a `failed` flag) instead of the colored output. |
| `--fail-on=LEVEL` | Exit with code `1` if any class reaches `LEVEL` (`WARNING` or `CRITICAL`). Without it the command always exits `0`. |
| `--save-baseline[=FILE]` | Save the current run as a baseline (default `.artie-baseline.json`) and exit `0`. |
| `--baseline[=FILE]` | Compare the current run against a baseline and report only **regressions** (classes that crossed into a worse band, or new offending classes). |
| `--watch` | Re-run on every file change. A development loop; ignores CI flags like `--fail-on`. |
| `--suggest` | Print concrete refactoring suggestions instead of the report (see below). |
| `--hotspots` | Rank files that are **both** structurally unhealthy and frequently changed (see below). Requires a git repository. |
| `--since=EXPR` | Churn window used by `--hotspots`. Any git date expression, default `"90 days ago"`. |

## Suggestions

`artie run --suggest` turns two metrics into concrete, deterministic refactoring advice
(no code is changed):

- **Circular dependencies** — lists the modules in each import cycle so you know exactly
  what to break.
- **Low cohesion** — for classes whose methods split into disjoint groups, it names each
  group and the fields it shares, pointing at a clean split (SRP).

```text
🔧 Suggestions

Circular dependencies (1):
  cycle: src/b.ts → src/a.ts
     Break it by extracting the shared code into a new module, or by depending
     on an interface/type instead of the concrete module.

Low cohesion (1):
  class Mixed splits into 2 cohesive groups:
     group 1: login, logout  (shares: user)
     group 2: addItem, clearCart  (shares: cart)
     Consider extracting each group into its own class (SRP).
```

## Architecture rules

Metrics are heuristics with thresholds. Architecture rules are **contracts you write**, so a
violation always fails the run (exit `1`), with or without `--fail-on`. Declare them under
`rules` in `.artierc.json`:

```json
{
  "rules": [
    {
      "from": "src/domain/**",
      "cannotImport": ["src/infra/**"],
      "message": "domain must not depend on infra"
    },
    {
      "from": "src/modules/billing/**",
      "canOnlyImport": ["src/modules/billing/**", "src/shared/**"]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `from` | Glob (or list) of the modules the rule applies to. |
| `cannotImport` | Glob (or list) of forbidden targets. |
| `canOnlyImport` | Allowlist: anything outside it is a violation. |
| `message` | Optional custom message shown on violation. |

```text
✖ 1 architecture violation(s):
  src/domain/user.ts → src/infra/db.ts
     domain must not depend on infra
```

Violations also appear in `--json`, so they compose with the CI gate.

## Hotspots

A bad class nobody touches is not urgent. A bad class that changes every week is a fire.
`artie run --hotspots` crosses the metrics with **git churn** (how many commits touched each
file in the window) so you know where to start:

```
score = churn × badness        badness: OK = 0, WARNING = 1, CRITICAL = 3 (summed per file)
```

```text
🔥 Hotspots (structural issues in files actually being changed, since 90 days ago)

[score 30] src/order-service.ts  (10 changes × badness 3)
     WMC CRITICAL OrderService (31)

[score 3] src/legacy-report.ts  (1 changes × badness 3)
     WMC CRITICAL LegacyReport (30)
```

Healthy files never rank, however often they change. Unhealthy files that nobody touches
rank low. Use `--since` to widen or narrow the window, and `--json` for the raw ranking.

## Continuous integration

Use `--fail-on` to gate a pipeline on absolute quality, and `--json` to feed the report
into other tooling:

```bash
artie run --fail-on=critical    # exit 1 if any class is CRITICAL
artie run --json > metrics.json # machine-readable report
```

### Gate on regressions only

On an existing codebase, failing on every pre-existing issue is noisy. Save a baseline
once, commit it, then fail the build only when a change makes design quality **worse**:

```bash
artie run --save-baseline       # once, then commit .artie-baseline.json
artie run --baseline --fail-on=warning   # in CI: exit 1 only on new regressions
```

With `--baseline`, `--fail-on` applies to the regressions (defaulting to `WARNING` when
omitted). A missing baseline file is a warning, not a failure, so first runs stay green.

GitHub Actions example:

```yaml
- name: Check for design regressions
  run: npx artie-lens run --baseline --fail-on=warning
```

### GitHub Action

A composite action wraps the CLI (it sets up Node and runs `artie-lens` for you). It reads
`.artierc.json` from the repository root:

```yaml
- uses: ariusxi/artie-lens@v1
  with:
    directory: .
    fail-on: critical
```

Gate on regressions instead (commit `.artie-baseline.json` first):

```yaml
- uses: ariusxi/artie-lens@v1
  with:
    baseline: 'true'
    fail-on: warning
```

| Input | Default | Description |
| --- | --- | --- |
| `directory` | `.` | Directory to analyze. |
| `fail-on` | (none) | Fail the job when a class reaches `warning` or `critical`. |
| `baseline` | (none) | `true` for the default baseline file, or a path. Reports only regressions. |
| `json` | `false` | Print the report as JSON. |
| `version` | `latest` | `artie-lens` version to run. |
| `node-version` | `20` | Node.js version to set up. |

## Contributing

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/), so
commit messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/)
(`fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major). See
[CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)

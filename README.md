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

All metrics are measured **per class** and follow the definitions in
_A Metrics Suite for Object Oriented Design_ (Chidamber & Kemerer, IEEE TSE, 1994).
Higher values mean higher complexity/risk.

| Metric | Name | What it measures | High value suggests |
| --- | --- | --- | --- |
| **WMC** | Weighted Methods per Class | Sum of the cyclomatic complexity of each method (constructors, accessors and arrow-function fields included). With trivial methods it equals the method count. | Class is doing too much; hard to test/maintain. |
| **CBO** | Coupling Between Object classes | Number of **other classes** this class depends on — via heritage, parameter/property/return types, and usages inside method bodies (`new`, calls, member access). | Fragile design; changes elsewhere ripple in. |
| **RFC** | Response For a Class | Size of the response set: the class's own methods **plus** the first-level methods they call. | Testing/debugging is harder (many methods can run per message). |
| **LCOM** | Lack of Cohesion in Methods | Pairs of methods that share **no** instance variable, minus the pairs that do (floored at 0). `0` when methods are cohesive or use no instance state. | Class mixes unrelated responsibilities; consider splitting (SRP). |

### Scope & known limitations

- **CBO** is **efferent** (fan-out) only — it counts what a class depends on, not what
  depends on it — and it does **not** count coupling to `interface`s (only concrete classes).
- **WMC** uses cyclomatic complexity as the per-method weight (a legitimate reading of the
  paper, which leaves the weight open). Static methods are included.
- **RFC** counts the first level of method calls only (as in the paper) and excludes calls
  to library/`node_modules`/declaration-file functions (e.g. `console.log`).
- **LCOM** excludes static methods, counts constructor **parameter properties** as instance
  variables, and does not track destructuring access (`const { x } = this`).

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
      "cbo": { "enabled": true }
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

## Contributing

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/), so
commit messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/)
(`fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major). See
[CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)

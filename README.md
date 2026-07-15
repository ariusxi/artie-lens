# Artie-Lens

[![npm version](https://img.shields.io/npm/v/artie-lens.svg)](https://www.npmjs.com/package/artie-lens)
[![CI](https://github.com/ariusxi/artie-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/ariusxi/artie-lens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Measure **design quality** in a TypeScript codebase, and fail CI when it gets worse.

Artie-Lens reads your code from the AST (via ts-morph) and answers three different questions:

- **What is bad?** Eight metrics, per class and per module.
- **Where do I start?** Hotspots: the metrics crossed with git churn.
- **What is forbidden?** Architecture rules you declare and that always fail the build.

## Install

```bash
npm install -g artie-lens
```

Requires **Node.js 20+** and a TypeScript project.

## Quick start

```bash
artie init      # creates .artierc.json
artie run       # analyze the current directory
```

```text
📊 WMC Metrics:
- Total: 22   Average: 2.44   Maximum: 11

Files:
[WARNING] OrderService → 11
   💡 Complexity is increasing → consider extracting helper methods or simplifying logic.
```

## What it measures

| | Metrics | Scope |
| --- | --- | --- |
| **Class** (CK suite) | WMC, DIT, NOC, CBO, RFC, LCOM | Complexity, inheritance, coupling, cohesion |
| **Module** | CE (efferent coupling), CYCLIC (circular deps) | Works on functional code with no classes |

Faithful to _A Metrics Suite for Object Oriented Design_ (Chidamber & Kemerer, 1994).
Definitions, and the limitations of each one, are in **[docs/metrics.md](./docs/metrics.md)**.

## Commands

| Command | Description |
| --- | --- |
| `artie init` | Create a `.artierc.json` with default settings. |
| `artie run [dir]` | Analyze and report. |
| `artie watch [dir]` | Re-run on every file change (development loop). |
| `artie suggest [dir]` | Concrete refactoring advice: which cycle to break, which methods to split. |
| `artie hotspots [dir]` | Rank files that are unhealthy **and** frequently changed. Needs git. |
| `artie seams [dir]` | Detect module communities and propose extraction boundaries. |
| `artie help` | List commands and options. |

## Gate your CI on regressions, not on old debt

Failing on every preexisting issue is noise, and noisy tools get silenced. Save a baseline
once, then fail the build only when a change makes the design **worse**:

```yaml
- uses: ariusxi/artie-lens@v1
  with:
    baseline: 'true'
    fail-on: warning
```

Details, including the absolute gate and `--json` output, in **[docs/ci.md](./docs/ci.md)**.

## Documentation

- **[Metrics](./docs/metrics.md)** what each metric means, and what it does not cover.
- **[Configuration](./docs/configuration.md)** `.artierc.json`, thresholds, includes/excludes.
- **[Architecture rules](./docs/rules.md)** declare forbidden boundaries between folders.
- **[Hotspots](./docs/hotspots.md)** metrics crossed with git churn.
- **[Seams](./docs/seams.md)** module communities as candidate extraction boundaries.
- **[Continuous integration](./docs/ci.md)** CI gate, baseline/diff, GitHub Action.
- **[Programmatic use](./docs/api.md)** the exported API.

## Contributing

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/), so commit
messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/). See
[CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)

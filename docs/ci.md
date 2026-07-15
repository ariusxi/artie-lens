# Continuous integration

## Absolute gate

Fail the build when any class crosses a threshold, and feed the report to other tooling:

```bash
artie run --fail-on=critical     # exit 1 if any class is CRITICAL
artie run --json > metrics.json  # machine-readable report
```

## Gate on regressions only (recommended for existing code)

Failing on every preexisting issue is noise, and noisy tools get silenced. Save a baseline
once, commit it, and then fail the build only when a change makes the design **worse**:

```bash
artie run --save-baseline                # once, then commit .artie-baseline.json
artie run --baseline --fail-on=warning   # in CI: exit 1 only on new regressions
```

A regression is a class that crossed into a worse band (`OK` → `WARNING`, `WARNING` →
`CRITICAL`) or a new class that is already unhealthy. With `--baseline`, `--fail-on` applies to
the regressions (defaulting to `WARNING` when omitted). A missing baseline file is a warning,
not a failure, so the first run stays green.

Architecture rules are **not** subject to the baseline: a violation always fails.
See [rules.md](./rules.md).

## Pull request comments

Instead of only failing the build, `artie comment` posts a sticky summary of the regressions
and architecture violations on the pull request, updating the same comment on each push instead
of adding new ones. It also gates: with `--fail-on`, it exits `1` when there is something to
review, so the check still blocks the PR.

It reads the PR context from the environment GitHub Actions provides (`GITHUB_TOKEN`,
`GITHUB_REPOSITORY`, and the event payload), and needs `pull-requests: write` permission.

```yaml
permissions:
  contents: read
  pull-requests: write
jobs:
  design:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ariusxi/artie-lens@v1
        with:
          comment: 'true'
          baseline: 'true'
          fail-on: warning
```

Outside a pull request (no token or PR number), the command skips the comment and just returns
the gate result.

## GitHub Action

A composite action wraps the CLI (it sets up Node and runs `artie-lens` for you) and reads
`.artierc.json` from the repository root:

```yaml
- uses: ariusxi/artie-lens@v1
  with:
    fail-on: critical
```

Gate on regressions instead:

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

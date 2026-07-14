# Architecture rules

Metrics are heuristics with thresholds, so you negotiate with them (via `--fail-on`, baselines
and diffs). Architecture rules are **contracts you wrote**. There is no "slightly violated", so
a violation **always fails the run** (exit `1`), with or without `--fail-on`, and it is not
excused by a baseline.

Declare them under `rules` in `.artierc.json`:

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

## Fields

| Field | Meaning |
| --- | --- |
| `from` | Glob (or list of globs) of the modules the rule applies to. |
| `cannotImport` | Glob (or list) of forbidden targets: a denylist. |
| `canOnlyImport` | Allowlist: importing anything outside it is a violation. |
| `message` | Optional message shown on violation. Defaults to `<from> must not import <to>`. |

Globs are matched against paths relative to the analyzed directory, always with forward
slashes.

## Output

```text
✖ 1 architecture violation(s):
  src/domain/user.ts → src/infra/db.ts
     domain must not depend on infra
```

Violations are also included in `--json`, so they compose with the CI gate.

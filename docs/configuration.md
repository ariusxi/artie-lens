# Configuration

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
  "rules": [],
  "includes": ["**/*.ts", "!**/*.d.ts"],
  "excludes": ["**/*.test.ts", "node_modules", "dist", "scripts/**"]
}
```

## Fields

| Field | Meaning |
| --- | --- |
| `metrics.<name>.enabled` | Whether the metric runs. |
| `metrics.<name>.warning` / `critical` | Per-metric thresholds. **If omitted, the metric inherits `defaultThresholds`** (so `cbo` above uses `warning: 10`, `critical: 20`). |
| `options.defaultThresholds.levels` | **Display filter**: only classes whose label is in this list are printed. Keep `"OK"` to show everything, drop it to show only problems. |
| `includes` / `excludes` | [fast-glob](https://github.com/mrmlnc/fast-glob) patterns, resolved relative to the analyzed directory. Note the plural keys. |
| `rules` | Architecture rules. See [rules.md](./rules.md). |

## How labels are assigned

A class or module is labelled by comparing its value against the thresholds:

- `value >= critical` → **CRITICAL**
- `value >= warning` → **WARNING**
- otherwise → **OK**

## tsconfig

When a `tsconfig.json` exists in the analyzed directory, its compiler options are loaded so
**path aliases** (for example `@/foo`) resolve. Without it, only relative imports resolve.

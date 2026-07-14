# Programmatic use

The metric functions are exported and can be used directly. Each returns
`{ total, label, value, file }[]`, one entry per class (or per module, for `CE` and `CYCLIC`).

```ts
import { calculateWMC } from 'artie-lens'

const results = await calculateWMC(
  process.cwd(),
  { enabled: true, warning: 10, critical: 25, levels: ['OK', 'WARNING', 'CRITICAL'] },
  ['**/*.ts', '!**/*.d.ts'],
  ['**/*.test.ts', 'node_modules'],
)

console.log(results) // [{ total: 25, label: 'CRITICAL', value: 'UserService', file: 'src/user.service.ts' }, ...]
```

`calculateCBO`, `calculateRFC`, `calculateLCOM`, `calculateDIT`, `calculateNOC`,
`calculateCE` and `calculateCyclic` share the same signature.

## Sharing one parsed project

Each `calculate*` call builds its own ts-morph project. To run several metrics over the same
codebase, build the analysis context once and reuse it:

```ts
import { buildAnalysisContext, metricRegistry } from 'artie-lens'

const context = await buildAnalysisContext(process.cwd(), ['**/*.ts'], ['node_modules'])
if (context) {
  const config = { enabled: true, warning: 10, critical: 25, levels: ['OK', 'WARNING', 'CRITICAL'] }

  const wmc = metricRegistry.wmc(context, config)
  const cbo = metricRegistry.cbo(context, config)
}
```

## Other exports

- `runLens(directory, options)` returns the full `RunReport` (`metrics`, `regressions`,
  `violations`, `failed`) and prints the human output unless `json` is set.
- `computeRegressions(baseline, current)`, `computeHotspots(report, churn)` and
  `checkRules(graph, directory, rules)` are pure functions you can call on your own data.

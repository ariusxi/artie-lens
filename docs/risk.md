# Risk (coverage × hotspots)

A hotspot tells you a file is complex and changes often. It does not tell you whether a change is
*safe*. `artie risk` adds that missing axis: it weights each hotspot by how much of it is **not
covered by tests**, so the files that are complex, churned **and** under-tested rise to the top.
Those are the changes most likely to break something.

```bash
artie risk
artie risk --coverage=coverage/lcov.info
artie risk --json
```

Example:

```
🎯 Risk (hotspots weighted by missing test coverage)

[risk 42.1] src/routines/run.routine.ts  (score 54, 18 changes, 22% covered)
[risk 24.8] src/index.ts                 (score 33, 11 changes, 25% covered)
[risk 2.2]  src/helpers/metric.helpers.ts (score 18, 6 changes, 88% covered)
```

The last line is the point: `metric.helpers.ts` is a bigger hotspot than `index.ts`, but it is
well tested, so its risk is low. A tested hotspot is a smaller problem than an untested one.

## The score

`risk = hotspot score × (1 - coverage)`, where the hotspot score is `churn × severity`. A file
fully covered has a risk of zero (still a hotspot, but a safe one); a file missing from the
coverage report is treated as fully uncovered, so its risk is its whole score.

## Coverage input

Point artie at an [lcov](https://github.com/linux-test-project/lcov) report (`lcov.info`), the
format every major JS/TS coverage tool emits:

```bash
vitest run --coverage --coverage.reporter=lcov
jest --coverage --coverageReporters=lcov
```

The path defaults to `coverage/lcov.info`. Override it with `--coverage=PATH` or persist it in
`.artierc.json`:

```json
{ "options": { "coverage": "coverage/lcov.info" } }
```

The dashboard shows the same ranking on its **Risk** tab, with a coverage bar per row; when no
coverage report is found it points you at this setting instead.

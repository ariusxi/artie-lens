# Dashboard

A visual, interactive report instead of the terminal list. The page ships the analysis as an
embedded JSON model plus a small vanilla-JS app, so it is a single self-contained file with no
network calls and nothing to install in the browser.

## Tabs

| Tab | What it shows |
|-----|---------------|
| Overview | KPI tiles (each with a trend sparkline from recorded history), issues-by-metric bars, a churn × severity hotspot treemap, and the worst offenders |
| Metrics | Per-metric value distribution histogram plus a searchable, sortable table of every class or module |
| Hotspots | Files ranked by complexity crossed with git churn |
| Modules | Findings rolled up by top-level directory |
| Seams | Cohesive clusters ranked as extraction candidates |
| Violations | Architecture-rule breaches and dependency cycles |

Every table is sortable (click a header) and filterable (the search box). Click any row with a
file to open a drill-down drawer with that file's full metric profile, findings, and cohesion
groups.

## Static HTML

`artie run --html[=FILE]` writes the self-contained dashboard to a file, so it opens anywhere
and is easy to attach to a build artifact.

```bash
artie run --html=report.html
```

## Live dashboard

`artie dashboard` serves that same dashboard on a local port and refreshes it in real time as
you edit files. It re-analyzes on every save and pushes the new model to the browser over
Server-Sent Events; the page re-renders in place (no reload) and flashes the rows that changed
with their delta, so you can watch a refactor move the numbers live.

```bash
artie dashboard            # http://localhost:4300
artie dashboard --port=8080
```

`artie run --html --watch` is an alias for the same thing.

The server needs no dependencies beyond the CLI, watches the analyzed directory (ignoring
`node_modules` and `.git`), and stops with Ctrl+C. Hotspots appear when the directory is a git
repository.

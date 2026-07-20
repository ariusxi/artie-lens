# Dashboard

Two ways to get a visual report instead of the terminal list.

## Static HTML

`artie run --html[=FILE]` writes a self-contained dashboard (KPI cards, an issues-by-metric
chart, worst offenders, hotspots and violations). It is a single file with everything inlined,
so it opens anywhere and is easy to attach to a build artifact.

```bash
artie run --html=report.html
```

## Live dashboard

`artie dashboard` serves that same dashboard on a local port and refreshes it in real time as
you edit files. It re-analyzes on every save and pushes the update to the browser over
Server-Sent Events, so the page updates on its own.

```bash
artie dashboard            # http://localhost:4300
artie dashboard --port=8080
```

`artie run --html --watch` is an alias for the same thing.

The server needs no dependencies beyond the CLI, watches the analyzed directory (ignoring
`node_modules` and `.git`), and stops with Ctrl+C. Hotspots appear when the directory is a git
repository.

# Seams

Where could you split a monolith? `artie seams` looks for **communities** in the module graph:
clusters of files that are tightly connected to each other and loosely connected to the rest.
A cluster with high internal cohesion and few boundary crossings is a natural place to extract
a package or a service.

```bash
artie seams
artie seams --json
```

It uses community detection (the Louvain method) over the import graph, treating imports as
undirected coupling.

## Output

```text
🧩 Seams (candidate module boundaries, 29 found, best first)

Seam 1: 7 modules · 6 internal · 3 crossing  → clean boundary, extraction candidate
     src/repl/native-functions/get-repl-fn.ts
     src/repl/native-functions/help-repl-fn.ts
     ...
```

- **internal**: dependencies that stay inside the cluster (cohesion).
- **crossing**: dependencies that cross the cluster boundary (coupling).
- `crossing == 0` is fully isolated; `crossing <= internal` is a clean candidate; more crossings
  than internal edges means the cluster is still tangled into the rest.

Seams are ranked by cohesion relative to coupling, so the most extractable clusters come first.

## Caveats

Be honest about what this is: a heuristic, and a starting point for a conversation, not a
prescription.

- Single-level community detection can fragment a dense graph into many small clusters. Look at
  the top few, not the count.
- Barrel files (`export * from`) tangle the graph. `options.ignoreReExports` can help (see
  [configuration.md](./configuration.md)).
- Needs no git and works on any TypeScript, class-heavy or functional.

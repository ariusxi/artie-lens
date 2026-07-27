# Dead code

`artie dead` lists **exported symbols that nothing imports** anywhere in the analyzed files:
functions, classes, interfaces, types, enums, and constants that are exported but never used.
They are the cheapest wins in a cleanup, and they quietly inflate every other metric.

```bash
artie dead
artie dead src
artie dead --json
```

Example:

```
🧹 Unused exports (3): exported but never imported anywhere in the analyzed files

src/helpers/legacy.ts:12  function oldFormatter
src/helpers/legacy.ts:41  const LEGACY_LIMIT
src/types/old.ts:3        interface DeprecatedShape
```

The same list appears on the dashboard's **Dead code** tab, sortable and filterable, where each
row drills into the file's full metric profile.

## How "dead" is decided

An export is reported when it has **no reference beyond its own declaration**. A symbol used
somewhere else, even within its own file, is considered alive, so genuine internal helpers are
never flagged (at most they are "exported unnecessarily", which this command leaves alone).

Two things follow from analyzing only the files you include:

- **Public API** exports are consumed from outside the project, so they look unused. List those
  entry files under `options.deadCode.entries` to skip them.
- **Test-only** exports look unused when tests are excluded from analysis (the default). Either
  include the tests or add their helpers to `entries`.

```json
{
  "options": {
    "deadCode": { "entries": ["src/index.ts", "src/public/**"] }
  }
}
```

`entries` accepts the same glob syntax as `includes`/`excludes`. Paths are matched relative to
the analyzed directory.

# Hotspots

A bad class nobody touches is not urgent. A bad class that changes every week is a fire.
`artie hotspots` crosses the metrics with **git churn** (how many commits touched each file in
the window) so the report answers *where do I start*, not just *what is bad*.

```bash
artie hotspots                      # default window: last 90 days
artie hotspots --since="6 months ago"
artie hotspots --json
```

## The model

```
score = churn × badness

badness per file = sum of the severity weights of its findings
                   OK = 0, WARNING = 1, CRITICAL = 3
```

The consequences are the whole point:

- A **healthy** file never ranks, however often it changes (badness `0`, so score `0`).
- An **unhealthy but frozen** file ranks low (churn is small).
- An **unhealthy and actively changed** file goes to the top. That is the fire.

## Output

```text
🔥 Hotspots (structural issues in files actually being changed, since 90 days ago)

[score 30] src/order-service.ts  (10 changes × badness 3)
     WMC CRITICAL OrderService (31)

[score 3] src/legacy-report.ts  (1 changes × badness 3)
     WMC CRITICAL LegacyReport (30)
```

## Requirements and caveats

- Needs a **git repository**. Outside one, the command warns and exits cleanly.
- Churn counts commits touching the file, not lines changed. It is a proxy for "this code is
  alive", not a measure of how much changed.
- The window matters. A 90 day default suits an active project; widen it with `--since` for a
  slower one.

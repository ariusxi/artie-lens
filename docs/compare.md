# Compare against a ref

`artie compare` answers the pull-request question directly: **did my branch make the design better
or worse?** It analyzes a git ref and diffs it against your working tree, class by class, and
reports what worsened, what is new, what improved, and what was resolved.

```bash
artie compare                 # working tree vs main
artie compare --against=develop
artie compare --against=HEAD~10 --json
```

Example:

```
🔀 Comparison vs main

   criticals: 6 → 8    warnings: 9 → 11

🔺 Worsened (2)
   CE src/routines/dashboard.routine.ts: WARNING 3 → CRITICAL 7
   WMC OrderService: WARNING 12 → CRITICAL 21

🆕 New findings (1)
   CE src/routines/risk.routine.ts: absent → CRITICAL 8
```

## How it works

The ref is checked out into a throwaway **detached git worktree** in your temp directory, analyzed
with your *current* configuration (so both sides are measured the same way), and then removed. Your
working tree is never touched, and uncommitted changes are included on the head side. It needs a
git repository and a ref that exists locally.

The dashboard has a **Compare** tab (live server only): type a ref, press Compare, and the same
diff renders as a table with a `from → to` transition per class and a base-to-head count summary.
Because it runs a second full analysis, it is computed on demand rather than on every refresh.

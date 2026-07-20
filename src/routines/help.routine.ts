const HELP_LINES = [
  'Artie-Lens: design metrics for TypeScript (CK class metrics, module coupling, cycles)',
  '',
  'Usage: artie <command> [directory] [options]',
  '',
  'Commands:',
  '  init              Create a .artierc.json file with default settings',
  '  run [dir]         Analyze the project and report the metrics',
  '  watch [dir]       Re-run on every file change (development loop)',
  '  suggest [dir]     Print concrete refactoring suggestions (cycles, low cohesion)',
  '  hotspots [dir]    Rank files that are unhealthy AND frequently changed (needs git)',
  '  seams [dir]       Detect module communities and propose extraction boundaries',
  '  comment [dir]     Post a summary of regressions and violations on the current PR (CI)',
  '  help              Show this message',
  '',
  'Options for run:',
  '  --json                    Print the report as JSON instead of the colored output',
  '  --fail-on=LEVEL           Exit 1 if any class reaches LEVEL (warning or critical)',
  '  --save-baseline[=FILE]    Save the current run as a baseline (default .artie-baseline.json)',
  '  --baseline[=FILE]         Compare against a baseline and report only regressions',
  '  --sarif[=FILE]            Also write a SARIF report (default artie-lens.sarif)',
  '  --html[=FILE]             Also write an HTML report (default artie-lens.html)',
  '',
  'Options for hotspots:',
  '  --since=EXPR              Churn window, any git date expression (default "90 days ago")',
  '  --json                    Print the ranking as JSON',
  '',
  'Architecture rules live under "rules" in .artierc.json and always fail the run.',
  'Docs: https://github.com/ariusxi/artie-lens',
]

export const showHelp = (): void => {
  console.log(HELP_LINES.join('\n'))
}

const HELP_LINES = [
  'Artie-Lens: design metrics for TypeScript (CK class metrics + module coupling and cycles)',
  '',
  'Usage: artie <command> [directory] [options]',
  '',
  'Commands:',
  '  init             Create a .artierc.json file with default settings',
  '  run [dir]        Analyze [dir] (default: current directory) using .artierc.json',
  '  help             Show this help message',
  '',
  'Options (run):',
  '  --json                 Print the full report as JSON instead of the colored output',
  '  --fail-on=LEVEL        Exit with code 1 if any class reaches LEVEL (WARNING or CRITICAL)',
  '  --save-baseline[=FILE] Save the current run as a baseline (default .artie-baseline.json)',
  '  --baseline[=FILE]      Compare against a baseline and report only regressions',
  '  --watch                Re-run on file changes (development loop)',
  '  --suggest              Print concrete refactoring suggestions (cycles and low cohesion)',
]

export const showHelp = (): void => {
  console.log(HELP_LINES.join('\n'))
}

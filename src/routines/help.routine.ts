export function showHelp() {
  console.log('Artie-Lens: CK design metrics (WMC, DIT, NOC, CBO, RFC, LCOM) for TypeScript\n')
  console.log('Usage: artie <command> [directory] [options]\n')
  console.log('Commands:')
  console.log('  init             Create a .artierc.json file with default settings')
  console.log('  run [dir]        Analyze [dir] (default: current directory) using .artierc.json')
  console.log('  help             Show this help message\n')
  console.log('Options (run):')
  console.log('  --json           Print the full report as JSON instead of the colored output')
  console.log('  --fail-on=LEVEL  Exit with code 1 if any class reaches LEVEL (WARNING or CRITICAL)')
}
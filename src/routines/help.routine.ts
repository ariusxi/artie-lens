export function showHelp() {
  console.log('Artie-Lens — CK design metrics (WMC, CBO, RFC, LCOM) for TypeScript\n')
  console.log('Usage: artie <command> [directory]\n')
  console.log('init        - Create a .artierc.json file with default settings')
  console.log('run [dir]   - Analyze [dir] (default: current directory) using .artierc.json')
  console.log('help        - Show this help message')
}
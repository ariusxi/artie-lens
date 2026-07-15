import { printMetric } from '../helpers/print.helpers'
import { buildAnalysisContext } from '../helpers/metric.helpers'
import { readConfig } from '../helpers/config.helpers'
import { cohesionFromContext, cyclesFromContext } from '../helpers/suggest.helpers'

export const suggestLens = async (directory = process.cwd()): Promise<void> => {
  const config = readConfig()
  const context = await buildAnalysisContext(directory, config.includes!, config.excludes!, config.options.ignoreReExports)
  const cycles = context ? cyclesFromContext(context) : []
  const cohesion = context ? cohesionFromContext(context) : []

  console.log('🔧 Suggestions\n')

  if (cycles.length === 0 && cohesion.length === 0) return console.log('Nothing to suggest. No import cycles and no low-cohesion classes found.')

  if (cycles.length) {
    console.log(`Circular dependencies (${cycles.length}):`)
    for (const cycle of cycles) {
      printMetric(`  cycle: ${cycle.path.join(' → ')}`, 'CRITICAL')
      const extra = cycle.size - (cycle.path.length - 1)
      if (extra > 0) console.log(`     (part of a ${cycle.size}-module cycle; ${extra} more connected through it, often barrels)`)
      console.log('     Break it by extracting the shared code into a new module, or by depending')
      console.log('     on an interface/type instead of the concrete module.\n')
    }
  }

  if (cohesion.length) {
    console.log(`Low cohesion (${cohesion.length}):`)
    for (const item of cohesion) {
      printMetric(`  class ${item.value} splits into ${item.groups.length} cohesive groups:`, 'WARNING')
      item.groups.forEach((group, index) => {
        console.log(`     group ${index + 1}: ${group.methods.join(', ')}  (shares: ${group.variables.join(', ')})`)
      })
      console.log('     Consider extracting each group into its own class (SRP).\n')
    }
  }
}

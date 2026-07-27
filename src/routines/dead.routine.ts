import { RunOptions } from '../types/config.interface'
import { readConfig } from '../helpers/config.helpers'
import { buildAnalysisContext } from '../helpers/metric.helpers'
import { findDeadExports } from '../helpers/dead.helpers'
import { printMetric } from '../helpers/print.helpers'

export const deadLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<void> => {
  const config = readConfig()
  const context = await buildAnalysisContext(directory, config.includes!, config.excludes!, config.options.ignoreReExports)
  const dead = context ? findDeadExports(context, config.options.deadCode?.entries ?? []) : []

  if (options.json) return console.log(JSON.stringify({ dead }, null, 2))

  if (!dead.length) return console.log('✓ No unused exports found.')

  console.log(`🧹 Unused exports (${dead.length}): exported but never imported anywhere in the analyzed files\n`)
  for (const item of dead) printMetric(`${item.file}:${item.line}  ${item.kind} ${item.name}`, 'WARNING')
  console.log('\nIf some of these are your public API, list their files under options.deadCode.entries in .artierc.json.')
}

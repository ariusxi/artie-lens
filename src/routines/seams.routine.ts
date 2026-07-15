import { relative } from 'path'

import { RunOptions } from '../types/config.interface'
import { printMetric } from '../helpers/print.helpers'
import { buildAnalysisContext } from '../helpers/metric.helpers'
import { readConfig } from '../helpers/config.helpers'
import { computeSeams, findCommunities } from '../helpers/seam.helpers'

const PREVIEW = 8
const SEAM_LIMIT = 10

const verdictOf = (internal: number, crossing: number): string => {
  if (crossing === 0) return 'isolated, a clean module boundary'
  if (crossing <= internal) return 'clean boundary, extraction candidate'
  return 'tangled, not a clean boundary yet'
}

export const seamLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<void> => {
  const config = readConfig()
  const context = await buildAnalysisContext(directory, config.includes!, config.excludes!, config.options.ignoreReExports)
  if (!context) return console.log('No source files found.')

  const seams = computeSeams(context.graph, findCommunities(context.graph))
  const relativeSeams = seams.map((seam) => ({ ...seam, modules: seam.modules.map((module) => relative(directory, module)) }))

  if (options.json) return console.log(JSON.stringify({ seams: relativeSeams }, null, 2))

  console.log(`🧩 Seams (candidate module boundaries, ${relativeSeams.length} found, best first)\n`)

  if (relativeSeams.length === 0) return console.log('No clear seams. The module graph did not split into cohesive clusters.')

  relativeSeams.slice(0, SEAM_LIMIT).forEach((seam, index) => {
    const clean = seam.crossing <= seam.internal
    printMetric(`Seam ${index + 1}: ${seam.modules.length} modules · ${seam.internal} internal · ${seam.crossing} crossing  → ${verdictOf(seam.internal, seam.crossing)}`, clean ? 'OK' : 'WARNING')
    for (const module of seam.modules.slice(0, PREVIEW)) console.log(`     ${module}`)
    if (seam.modules.length > PREVIEW) console.log(`     ... and ${seam.modules.length - PREVIEW} more`)
    console.log('')
  })
}

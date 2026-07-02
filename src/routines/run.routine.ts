import { watch } from 'chokidar'

import { MetricConfig, MetricInsights, MetricReport, MetricResult, Regression, RunOptions, RunReport } from '../types/config.interface'
import { printMetric } from '../helpers/print.helpers'
import { calculateCBO, calculateCE, calculateCyclic, calculateDIT, calculateLCOM, calculateNOC, calculateRFC, calculateWMC, metricInsights, severityRank } from '../helpers/metric.helpers'
import { getEnableMetrics, getMetricConfig, getMetricIndexes, readConfig } from '../helpers/config.helpers'
import { computeRegressions, readBaseline, writeBaseline } from '../helpers/baseline.helpers'
import { suggestCohesion, suggestCycles } from '../helpers/suggest.helpers'

const WATCH_DEBOUNCE_MS = 200

type MetricFunction = (directory: string, config: MetricConfig, includes: string[], excludes: string[]) => Promise<MetricResult[]>

interface MetricBlock {
  metric: string
  summary: MetricInsights
  visible: MetricResult[]
}

const metricsMap: Record<string, MetricFunction> = {
  cbo: calculateCBO,
  rfc: calculateRFC,
  lcom: calculateLCOM,
  wmc: calculateWMC,
  dit: calculateDIT,
  noc: calculateNOC,
  ce: calculateCE,
  cyclic: calculateCyclic,
}

const printMetricSummary = (metric: string, indexes: MetricInsights): void => {
  const lines = [
    `\n📊 ${metric.toUpperCase()} Metrics:`,
    `- Total: ${indexes.total}`,
    `- Average: ${indexes.average}`,
    `- Maximum: ${indexes.max}`,
    `- Minimum: ${indexes.min}`,
    `- Standard Deviation: ${indexes.deviation}`,
  ]
  console.log(lines.join('\n'))
}

const sortBySeverity = (items: MetricResult[]): MetricResult[] =>
  [...items].sort((a, b) => severityRank(b.label) - severityRank(a.label) || b.total - a.total)

const printMetricFiles = (metric: string, result: MetricResult[]): void => {
  if (!result.length) return

  console.log('\nFiles:')
  for (const item of sortBySeverity(result)) {
    printMetric(`[${item.label}] ${item.value} → ${item.total}`, item.label)
    const insight = metricInsights[metric][item.label]
    console.log(`   💡 ${insight}`)
  }
}

const printRegressions = (regressions: Regression[], baselinePath: string): void => {
  if (!regressions.length) return console.log(`\n✓ No regressions vs baseline (${baselinePath}).`)

  console.log(`\n✖ ${regressions.length} regression(s) vs baseline (${baselinePath}):`)
  for (const item of regressions) {
    const label = `[${item.to}] ${item.metric.toUpperCase()} ${item.value}: ${item.from} ${item.fromTotal} → ${item.to} ${item.toTotal}`
    printMetric(label, item.to)
  }
}

const collectReport = async (directory: string, options: RunOptions): Promise<{ report: MetricReport[]; blocks: MetricBlock[]; worstSeverity: number }> => {
  const config = readConfig()
  const metrics = getEnableMetrics(config)

  const report: MetricReport[] = []
  const blocks: MetricBlock[] = []
  let worstSeverity = 0

  for (const metric of metrics) {
    const thresholds = getMetricConfig(metric)
    const result = await metricsMap[metric](directory, thresholds, config.includes!, config.excludes!)
    const visible = result.filter((item) => thresholds.levels!.includes(item.label))
    const summary = getMetricIndexes(visible)

    report.push({ metric, summary, classes: result })
    blocks.push({ metric, summary, visible })
    for (const item of result) worstSeverity = Math.max(worstSeverity, severityRank(item.label))
  }

  return { report, blocks, worstSeverity }
}

const saveBaseline = (options: RunOptions, report: MetricReport[]): RunReport => {
  writeBaseline(options.saveBaseline!, report)
  const result: RunReport = { metrics: report, failed: false }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return result
  }

  console.log(`✓ Baseline saved to ${options.saveBaseline}`)
  return result
}

const runBaseline = (options: RunOptions, report: MetricReport[]): RunReport => {
  const baseline = readBaseline(options.baseline!)
  if (!baseline) {
    if (!options.json) console.log(`⚠️  Baseline not found (${options.baseline}). Create one with: artie run --save-baseline`)
    return { metrics: report, regressions: [], failed: false }
  }

  const regressions = computeRegressions(baseline, report)
  const gate = options.failOn ? severityRank(options.failOn) : severityRank('WARNING')
  const failed = regressions.some((item) => severityRank(item.to) >= gate)
  const result: RunReport = { metrics: report, regressions, failed }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return result
  }

  printRegressions(regressions, options.baseline!)
  return result
}

export const runLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<RunReport> => {
  const { report, blocks, worstSeverity } = await collectReport(directory, options)

  if (options.saveBaseline) return saveBaseline(options, report)
  if (options.baseline) return runBaseline(options, report)

  const gate = options.failOn ? severityRank(options.failOn) : 0
  const failed = gate > 0 && worstSeverity >= gate
  const result: RunReport = { metrics: report, failed }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return result
  }

  for (const block of blocks) {
    printMetricSummary(block.metric, block.summary)
    printMetricFiles(block.metric, block.visible)
  }
  if (failed) console.log(`\n✖ Failing: found classes at or above ${options.failOn!.toUpperCase()}.`)

  return result
}

export const suggestLens = async (directory = process.cwd()): Promise<void> => {
  const config = readConfig()
  const cycles = await suggestCycles(directory, config.includes!, config.excludes!)
  const cohesion = await suggestCohesion(directory, config.includes!, config.excludes!)

  console.log('🔧 Suggestions\n')

  if (cycles.length === 0 && cohesion.length === 0) return console.log('Nothing to suggest. No import cycles and no low-cohesion classes found.')

  if (cycles.length) {
    console.log(`Circular dependencies (${cycles.length}):`)
    for (const cycle of cycles) {
      printMetric(`  cycle: ${cycle.modules.join(' → ')}`, 'CRITICAL')
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

export const watchLens = (directory = process.cwd(), options: RunOptions = {}): void => {
  const trigger = () => {
    console.clear()
    console.log('artie-lens watching for changes. Press Ctrl+C to stop.\n')
    runLens(directory, { ...options, watch: false, json: false, failOn: undefined }).catch((error) => console.error(error))
  }

  trigger()

  let timer: ReturnType<typeof setTimeout> | undefined
  const watcher = watch(directory, {
    ignored: (path) => path.includes('node_modules') || path.includes('/.git/'),
    ignoreInitial: true,
  })

  watcher.on('all', (_event, path) => {
    if (!path.endsWith('.ts')) return
    clearTimeout(timer)
    timer = setTimeout(trigger, WATCH_DEBOUNCE_MS)
  })
}

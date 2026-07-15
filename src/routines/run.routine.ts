import { watch } from 'chokidar'

import { MetricInsights, MetricReport, MetricResult, Regression, RuleViolation, RunOptions, RunReport } from '../types/config.interface'
import { printMetric } from '../helpers/print.helpers'
import { buildAnalysisContext, metricInsights, metricRegistry, severityRank } from '../helpers/metric.helpers'
import { getEnableMetrics, getMetricIndexes, readConfig, resolveMetricConfig } from '../helpers/config.helpers'
import { computeRegressions, readBaseline, writeBaseline } from '../helpers/baseline.helpers'
import { suggestCohesion, suggestCycles } from '../helpers/suggest.helpers'
import { DEFAULT_SINCE, getChurn } from '../helpers/git.helpers'
import { computeHotspots, HOTSPOT_LIMIT } from '../helpers/hotspot.helpers'
import { checkRules } from '../helpers/rule.helpers'

const WATCH_DEBOUNCE_MS = 200

interface MetricBlock {
  metric: string
  summary: MetricInsights
  visible: MetricResult[]
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

const collectReport = async (directory: string): Promise<{ report: MetricReport[]; blocks: MetricBlock[]; worstSeverity: number; violations: RuleViolation[] }> => {
  const config = readConfig()
  const metrics = getEnableMetrics(config)
  const context = await buildAnalysisContext(directory, config.includes!, config.excludes!, config.options.ignoreReExports)

  const report: MetricReport[] = []
  const blocks: MetricBlock[] = []
  let worstSeverity = 0

  for (const metric of metrics) {
    const thresholds = resolveMetricConfig(config, metric)
    const result = context ? metricRegistry[metric](context, thresholds) : []
    const visible = result.filter((item) => thresholds.levels!.includes(item.label))
    const summary = getMetricIndexes(visible)

    report.push({ metric, summary, classes: result })
    blocks.push({ metric, summary, visible })
    for (const item of result) worstSeverity = Math.max(worstSeverity, severityRank(item.label))
  }

  const violations = context && config.rules ? checkRules(context.graph, directory, config.rules) : []

  return { report, blocks, worstSeverity, violations }
}

const printViolations = (violations: RuleViolation[]): void => {
  if (!violations.length) return

  console.log(`\n✖ ${violations.length} architecture violation(s):`)
  for (const violation of violations) {
    printMetric(`  ${violation.from} → ${violation.to}`, 'CRITICAL')
    console.log(`     ${violation.message}`)
  }
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

const runBaseline = (options: RunOptions, report: MetricReport[], violations: RuleViolation[]): RunReport => {
  const baseline = readBaseline(options.baseline!)
  if (!baseline) {
    if (!options.json) console.log(`⚠️  Baseline not found (${options.baseline}). Create one with: artie run --save-baseline`)
    return { metrics: report, regressions: [], violations, failed: violations.length > 0 }
  }

  const regressions = computeRegressions(baseline, report)
  const gate = options.failOn ? severityRank(options.failOn) : severityRank('WARNING')
  const regressed = regressions.some((item) => severityRank(item.to) >= gate)
  const failed = regressed || violations.length > 0
  const result: RunReport = { metrics: report, regressions, violations, failed }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return result
  }

  printRegressions(regressions, options.baseline!)
  printViolations(violations)
  return result
}

export const runLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<RunReport> => {
  const { report, blocks, worstSeverity, violations } = await collectReport(directory)

  if (options.saveBaseline) return saveBaseline(options, report)
  if (options.baseline) return runBaseline(options, report, violations)

  const gate = options.failOn ? severityRank(options.failOn) : 0
  const metricFailed = gate > 0 && worstSeverity >= gate
  const failed = metricFailed || violations.length > 0
  const result: RunReport = { metrics: report, violations, failed }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return result
  }

  for (const block of blocks) {
    printMetricSummary(block.metric, block.summary)
    printMetricFiles(block.metric, block.visible)
  }
  printViolations(violations)
  if (metricFailed) console.log(`\n✖ Failing: found classes at or above ${options.failOn!.toUpperCase()}.`)

  return result
}

export const hotspotLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<void> => {
  const since = options.since ?? DEFAULT_SINCE
  const churn = getChurn(directory, since)

  if (!churn) return console.log('⚠️  Not a git repository. Hotspots need commit history to measure churn.')

  const { report } = await collectReport(directory)
  const hotspots = computeHotspots(report, churn)

  if (options.json) return console.log(JSON.stringify({ since, hotspots }, null, 2))

  console.log(`🔥 Hotspots (structural issues in files actually being changed, since ${since})\n`)

  if (hotspots.length === 0) return console.log('No hotspots. Either the changed files are healthy, or the unhealthy ones are not being touched.')

  for (const hotspot of hotspots.slice(0, HOTSPOT_LIMIT)) {
    const label = hotspot.findings.some((finding) => finding.includes('CRITICAL')) ? 'CRITICAL' : 'WARNING'
    printMetric(`[score ${hotspot.score}] ${hotspot.file}  (${hotspot.churn} changes × badness ${hotspot.badness})`, label)
    for (const finding of hotspot.findings) console.log(`     ${finding}`)
    console.log('')
  }
}

export const suggestLens = async (directory = process.cwd()): Promise<void> => {
  const config = readConfig()
  const cycles = await suggestCycles(directory, config.includes!, config.excludes!, config.options.ignoreReExports)
  const cohesion = await suggestCohesion(directory, config.includes!, config.excludes!)

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

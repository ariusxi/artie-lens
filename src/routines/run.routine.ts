import { printMetric } from '../helpers/printHelpers'
import { MetricConfig, MetricInsights, MetricReport, MetricResult, Regression, RunOptions, RunReport } from '../types/config.interface'
import { calculateCBO, calculateDIT, calculateLCOM, calculateNOC, calculateRFC, calculateWMC, metricInsights, severityRank } from '../helpers/metricHelpers'
import { getEnableMetrics, getMetricConfig, getMetricIndexes, readConfig } from '../helpers/configHelpers'
import { computeRegressions, readBaseline, writeBaseline } from '../helpers/baselineHelpers'

type MetricFunction = (
  directory: string,
  config: MetricConfig,
  includes: string[],
  excludes: string[]
) => Promise<MetricResult[]>

const metricsMap: Record<string, MetricFunction> = {
  cbo: calculateCBO,
  rfc: calculateRFC,
  lcom: calculateLCOM,
  wmc: calculateWMC,
  dit: calculateDIT,
  noc: calculateNOC,
}

function printMetricSummary(metric: string, indexes: MetricInsights) {
  console.log(`\n📊 ${metric.toUpperCase()} Metrics:`)
  console.log(`- Total: ${indexes.total}`)
  console.log(`- Average: ${indexes.average}`)
  console.log(`- Maximum: ${indexes.max}`)
  console.log(`- Minimum: ${indexes.min}`)
  console.log(`- Standard Deviation: ${indexes.deviation}`)
}

function sortBySeverity(items: MetricResult[]): MetricResult[] {
  return [...items].sort((a, b) => severityRank(b.label) - severityRank(a.label) || b.total - a.total)
}

function printMetricFiles(metric: string, result: MetricResult[]) {
  if (!result.length) return

  console.log('\nFiles:')
  for (const item of sortBySeverity(result)) {
    printMetric(`[${item.label}] ${item.value} → ${item.total}`, item.label)
    const insight = metricInsights[metric][item.label]
    console.log(`   💡 ${insight}`)
  }
}

function printRegressions(regressions: Regression[], baselinePath: string) {
  if (!regressions.length) {
    console.log(`\n✓ No regressions vs baseline (${baselinePath}).`)
    return
  }

  console.log(`\n✖ ${regressions.length} regression(s) vs baseline (${baselinePath}):`)
  for (const item of regressions) {
    const label = `[${item.to}] ${item.metric.toUpperCase()} ${item.value}: ${item.from} ${item.fromTotal} → ${item.to} ${item.toTotal}`
    printMetric(label, item.to)
  }
}

export async function runLens(directory = process.cwd(), options: RunOptions = {}): Promise<RunReport> {
  const config = readConfig()
  const metrics = getEnableMetrics(config)

  const report: MetricReport[] = []
  const blocks: { metric: string; summary: MetricInsights; visible: MetricResult[] }[] = []
  let worstSeverity = 0

  for (const metric of metrics) {
    const thresholds = getMetricConfig(metric)
    const result = await metricsMap[metric](directory, thresholds, config.includes, config.excludes)

    const visible = result.filter((item) => thresholds.levels!.includes(item.label))
    const summary = getMetricIndexes(visible)

    report.push({ metric, summary, classes: result })
    blocks.push({ metric, summary, visible })
    for (const item of result) worstSeverity = Math.max(worstSeverity, severityRank(item.label))
  }

  if (options.saveBaseline) {
    writeBaseline(options.saveBaseline, report)
    if (options.json) console.log(JSON.stringify({ metrics: report, failed: false }, null, 2))
    else console.log(`✓ Baseline saved to ${options.saveBaseline}`)
    return { metrics: report, failed: false }
  }

  let regressions: Regression[] | undefined
  let failed: boolean

  if (options.baseline) {
    const baseline = readBaseline(options.baseline)
    if (!baseline) {
      if (!options.json) console.log(`⚠️  Baseline not found (${options.baseline}). Create one with: artie run --save-baseline`)
      return { metrics: report, regressions: [], failed: false }
    }
    regressions = computeRegressions(baseline, report)
    const gate = options.failOn ? severityRank(options.failOn) : severityRank('WARNING')
    failed = regressions.some((item) => severityRank(item.to) >= gate)
  } else {
    const gate = options.failOn ? severityRank(options.failOn) : 0
    failed = gate > 0 && worstSeverity >= gate
  }

  if (options.json) {
    console.log(JSON.stringify({ metrics: report, regressions, failed }, null, 2))
    return { metrics: report, regressions, failed }
  }

  if (options.baseline) {
    printRegressions(regressions!, options.baseline)
  } else {
    for (const { metric, summary, visible } of blocks) {
      printMetricSummary(metric, summary)
      printMetricFiles(metric, visible)
    }
    if (failed) console.log(`\n✖ Failing: found classes at or above ${options.failOn!.toUpperCase()}.`)
  }

  return { metrics: report, regressions, failed }
}
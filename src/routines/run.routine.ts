import { printMetric } from '../helpers/printHelpers'
import { MetricConfig, MetricInsights, MetricReport, MetricResult, RunOptions, RunReport } from '../types/config.interface'
import { calculateCBO, calculateDIT, calculateLCOM, calculateNOC, calculateRFC, calculateWMC, metricInsights, severityRank } from '../helpers/metricHelpers'
import { getEnableMetrics, getMetricConfig, getMetricIndexes, readConfig } from '../helpers/configHelpers'

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

function printMetricFiles(metric: string, result: MetricResult[]) {
  if (!result.length) return

  console.log('\nFiles:')
  for (const item of result) {
    printMetric(`[${item.label}] ${item.value} → ${item.total}`, item.label)
    const insight = metricInsights[metric][item.label]
    console.log(`   💡 ${insight}`)
  }
}

export async function runLens(directory = process.cwd(), options: RunOptions = {}): Promise<RunReport> {
  const config = readConfig()
  const metrics = getEnableMetrics(config)

  const failThreshold = options.failOn ? severityRank(options.failOn) : 0
  const report: MetricReport[] = []
  let worstSeverity = 0

  if (!options.json) console.time('Total time')

  for (const metric of metrics) {
    const thresholds = getMetricConfig(metric)
    const result = await metricsMap[metric](directory, thresholds, config.includes, config.excludes)

    const visible = result.filter((item) => thresholds.levels!.includes(item.label))
    const indexes = getMetricIndexes(visible)

    report.push({ metric, summary: indexes, classes: result })
    for (const item of result) worstSeverity = Math.max(worstSeverity, severityRank(item.label))

    if (!options.json) {
      printMetricSummary(metric, indexes)
      printMetricFiles(metric, visible)
    }
  }

  const failed = failThreshold > 0 && worstSeverity >= failThreshold

  if (options.json) {
    console.log(JSON.stringify({ metrics: report, failed }, null, 2))
  } else {
    console.timeEnd('Total time')
    if (failed) console.log(`\n✖ Failing: found classes at or above ${options.failOn!.toUpperCase()}.`)
  }

  return { metrics: report, failed }
}
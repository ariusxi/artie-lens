import { printMetric } from '../helpers/printHelpers'
import { MetricConfig, MetricInsights, MetricResult } from '../types/config.interface'
import { calculateCBO, calculateLCOM, calculateRFC, calculateWMC, metricInsights } from '../helpers/metricHelpers'
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

export async function runLens(directory = process.cwd()) {
  const config = readConfig()
  const metrics = getEnableMetrics(config)

  console.time('Total time')
  for (const metric of metrics) {
    const thresholds = getMetricConfig(metric)
    const result = await metricsMap[metric](directory, thresholds, config.includes, config.excludes)
    
    const currentFiles = result.filter((item) => thresholds.levels.includes(item.label))

    const indexes = getMetricIndexes(currentFiles)
    printMetricSummary(metric, indexes)
    printMetricFiles(metric, currentFiles)
  }
  console.timeEnd('Total time')
}
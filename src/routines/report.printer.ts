import { MetricInsights, MetricResult, Regression, RuleViolation } from '../types/config.interface'
import { printMetric } from '../helpers/print.helpers'
import { metricInsights, severityRank } from '../helpers/metric.helpers'

export const printMetricSummary = (metric: string, indexes: MetricInsights): void => {
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

export const printMetricFiles = (metric: string, result: MetricResult[]): void => {
  if (!result.length) return

  console.log('\nFiles:')
  for (const item of sortBySeverity(result)) {
    printMetric(`[${item.label}] ${item.value} → ${item.total}`, item.label)
    console.log(`   💡 ${metricInsights[metric][item.label]}`)
  }
}

export const printRegressions = (regressions: Regression[], baselinePath: string): void => {
  if (!regressions.length) return console.log(`\n✓ No regressions vs baseline (${baselinePath}).`)

  console.log(`\n✖ ${regressions.length} regression(s) vs baseline (${baselinePath}):`)
  for (const item of regressions) {
    const label = `[${item.to}] ${item.metric.toUpperCase()} ${item.value}: ${item.from} ${item.fromTotal} → ${item.to} ${item.toTotal}`
    printMetric(label, item.to)
  }
}

export const printViolations = (violations: RuleViolation[]): void => {
  if (!violations.length) return

  console.log(`\n✖ ${violations.length} architecture violation(s):`)
  for (const violation of violations) {
    printMetric(`  ${violation.from} → ${violation.to}`, 'CRITICAL')
    console.log(`     ${violation.message}`)
  }
}

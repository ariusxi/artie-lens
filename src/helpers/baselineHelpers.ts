import { existsSync, readFileSync, writeFileSync } from 'fs'

import { MetricReport, Regression } from '../types/config.interface'
import { severityRank } from './metricHelpers'

export const DEFAULT_BASELINE = '.artie-baseline.json'

export function writeBaseline(path: string, metrics: MetricReport[]): void {
  writeFileSync(path, JSON.stringify({ metrics }, null, 2))
}

export function readBaseline(path: string): MetricReport[] | null {
  if (!existsSync(path)) return null

  const content = JSON.parse(readFileSync(path, 'utf-8'))
  return content.metrics ?? []
}

export function computeRegressions(baseline: MetricReport[], current: MetricReport[]): Regression[] {
  const regressions: Regression[] = []

  const baselineIndex = new Map(
    baseline.map((report) => [report.metric, new Map(report.classes.map((item) => [item.value, item]))]),
  )

  for (const report of current) {
    const baselineClasses = baselineIndex.get(report.metric)

    for (const item of report.classes) {
      const before = baselineClasses?.get(item.value)
      // A class missing from the baseline is treated as previously healthy (OK)
      const beforeSeverity = before ? severityRank(before.label) : severityRank('OK')
      const afterSeverity = severityRank(item.label)

      if (afterSeverity > beforeSeverity && afterSeverity >= severityRank('WARNING')) {
        regressions.push({
          metric: report.metric,
          value: item.value,
          from: before ? before.label : 'NEW',
          to: item.label,
          fromTotal: before ? before.total : 0,
          toTotal: item.total,
        })
      }
    }
  }

  return regressions
}

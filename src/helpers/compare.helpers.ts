import { MetricReport, MetricResult } from '../types/config.interface'
import { severityRank } from './metric.helpers'

export type ChangeKind = 'worse' | 'new' | 'better' | 'gone'

export interface MetricDelta {
  metric: string
  value: string
  file?: string
  fromLabel: string | null
  toLabel: string | null
  fromTotal: number | null
  toTotal: number | null
  change: ChangeKind
}

export interface Comparison {
  ref: string
  base: { criticals: number; warnings: number }
  head: { criticals: number; warnings: number }
  deltas: MetricDelta[]
}

const countSide = (report: MetricReport[]): { criticals: number; warnings: number } => {
  let criticals = 0
  let warnings = 0
  for (const metric of report) {
    for (const item of metric.classes) {
      if (item.label === 'CRITICAL') criticals += 1
      if (item.label === 'WARNING') warnings += 1
    }
  }
  return { criticals, warnings }
}

const byValue = (classes: MetricResult[]): Map<string, MetricResult> =>
  new Map(classes.map((item) => [item.value, item]))

// Decides how a single class moved between the two runs. Returns null when nothing worth showing
// changed (OK stayed OK, or an identical finding).
const classifyChange = (base: MetricResult | undefined, head: MetricResult | undefined): ChangeKind | null => {
  if (!base) return head && head.label !== 'OK' ? 'new' : null
  if (!head) return base.label !== 'OK' ? 'gone' : null

  const rankDelta = severityRank(head.label) - severityRank(base.label)
  if (rankDelta > 0) return 'worse'
  if (rankDelta < 0) return 'better'
  if (head.total > base.total) return 'worse'
  if (head.total < base.total) return 'better'
  return null
}

const ORDER: Record<ChangeKind, number> = { worse: 0, new: 1, better: 2, gone: 3 }

// Diffs two reports class by class, keyed by metric and class/module name, keeping only the
// entries that meaningfully moved. `base` is the older ref, `head` the current working tree.
export const compareReports = (base: MetricReport[], head: MetricReport[], ref: string): Comparison => {
  const baseByMetric = new Map(base.map((metric) => [metric.metric, byValue(metric.classes)]))
  const headByMetric = new Map(head.map((metric) => [metric.metric, byValue(metric.classes)]))
  const metrics = new Set([...baseByMetric.keys(), ...headByMetric.keys()])
  const deltas: MetricDelta[] = []

  for (const metric of metrics) {
    const baseClasses = baseByMetric.get(metric) ?? new Map()
    const headClasses = headByMetric.get(metric) ?? new Map()

    for (const value of new Set([...baseClasses.keys(), ...headClasses.keys()])) {
      const from = baseClasses.get(value)
      const to = headClasses.get(value)
      const change = classifyChange(from, to)
      if (!change) continue

      deltas.push({
        metric,
        value,
        file: (to ?? from)!.file,
        fromLabel: from ? from.label : null,
        toLabel: to ? to.label : null,
        fromTotal: from ? from.total : null,
        toTotal: to ? to.total : null,
        change,
      })
    }
  }

  deltas.sort((a, b) => ORDER[a.change] - ORDER[b.change] || (b.toTotal ?? b.fromTotal ?? 0) - (a.toTotal ?? a.fromTotal ?? 0))
  return { ref, base: countSide(base), head: countSide(head), deltas }
}

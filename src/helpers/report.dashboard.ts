import { Hotspot, MetricReport, MetricResult, RuleViolation } from '../types/config.interface'
import { DashboardView, renderDashboard } from '../templates/dashboard.template'

export interface DashboardData {
  report: MetricReport[]
  violations: RuleViolation[]
  hotspots: Hotspot[]
  generatedAt: string
  live: boolean
}

const OFFENDER_LIMIT = 15

const countBy = (classes: MetricResult[], label: string): number => classes.filter((item) => item.label === label).length

const barsFrom = (report: MetricReport[]): DashboardView['bars'] =>
  report.map((metric) => ({ metric: metric.metric, warning: countBy(metric.classes, 'WARNING'), critical: countBy(metric.classes, 'CRITICAL') }))

const offendersFrom = (report: MetricReport[]): DashboardView['offenders'] =>
  report
    .flatMap((metric) => metric.classes.filter((item) => item.label !== 'OK').map((item) => ({ label: item.label, metric: metric.metric, value: item.value, total: item.total })))
    .sort((a, b) => (a.label === b.label ? b.total - a.total : a.label === 'CRITICAL' ? -1 : 1))
    .slice(0, OFFENDER_LIMIT)

export const buildDashboard = (data: DashboardData): string => {
  const bars = barsFrom(data.report)
  const criticals = bars.reduce((sum, item) => sum + item.critical, 0)
  const warnings = bars.reduce((sum, item) => sum + item.warning, 0)

  const view: DashboardView = {
    generatedAt: data.generatedAt,
    live: data.live,
    failed: criticals > 0 || data.violations.length > 0,
    kpis: { criticals, warnings, violations: data.violations.length, hotspots: data.hotspots.length, metrics: data.report.length },
    bars,
    offenders: offendersFrom(data.report),
    hotspots: data.hotspots,
    violations: data.violations,
  }

  return renderDashboard(view)
}

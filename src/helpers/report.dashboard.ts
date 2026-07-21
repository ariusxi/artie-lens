import { Hotspot, MetricReport, MetricResult, RuleViolation, Seam, Snapshot } from '../types/config.interface'
import { CohesionSuggestion, CycleSuggestion } from './suggest.helpers'
import { DashboardMetric, DashboardModel, renderDashboard } from '../templates/dashboard.template'

export interface DashboardData {
  report: MetricReport[]
  violations: RuleViolation[]
  hotspots: Hotspot[]
  generatedAt: string
  live: boolean
  seams?: Seam[]
  history?: Snapshot[]
  cycles?: CycleSuggestion[]
  cohesion?: CohesionSuggestion[]
}

const countBy = (classes: MetricResult[], label: string): number => classes.filter((item) => item.label === label).length

const metricsFrom = (report: MetricReport[]): DashboardMetric[] =>
  report.map((metric) => ({
    name: metric.metric,
    warning: countBy(metric.classes, 'WARNING'),
    critical: countBy(metric.classes, 'CRITICAL'),
    entries: metric.classes,
  }))

export const buildDashboardModel = (data: DashboardData): DashboardModel => {
  const metrics = metricsFrom(data.report)
  const criticals = metrics.reduce((sum, item) => sum + item.critical, 0)
  const warnings = metrics.reduce((sum, item) => sum + item.warning, 0)

  return {
    generatedAt: data.generatedAt,
    live: data.live,
    failed: criticals > 0 || data.violations.length > 0,
    kpis: { criticals, warnings, violations: data.violations.length, hotspots: data.hotspots.length, metrics: metrics.length },
    metrics,
    violations: data.violations,
    hotspots: data.hotspots,
    seams: data.seams ?? [],
    history: data.history ?? [],
    cycles: data.cycles ?? [],
    cohesion: data.cohesion ?? [],
  }
}

export const buildDashboard = (data: DashboardData): string => renderDashboard(buildDashboardModel(data))

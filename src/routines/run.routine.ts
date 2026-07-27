import { ArtieConfig, MetricInsights, MetricReport, MetricResult, RuleViolation, RunOptions, RunReport } from '../types/config.interface'
import { AnalysisContext, buildAnalysisContext, metricRegistry, severityRank } from '../helpers/metric.helpers'
import { getEnableMetrics, getMetricIndexes, readConfig, resolveMetricConfig } from '../helpers/config.helpers'
import { computeRegressions, readBaseline, writeBaseline } from '../helpers/baseline.helpers'
import { checkRules } from '../helpers/rule.helpers'
import { buildSarif } from '../helpers/sarif.helpers'
import { buildDashboard, DashboardData } from '../helpers/report.dashboard'
import { addWorktree, DEFAULT_SINCE, getChurn, getCurrentCommit, removeWorktree } from '../helpers/git.helpers'
import { computeHotspots } from '../helpers/hotspot.helpers'
import { computeSeams, findCommunities } from '../helpers/seam.helpers'
import { cohesionFromContext, cyclesFromContext } from '../helpers/suggest.helpers'
import { findDeadExports } from '../helpers/dead.helpers'
import { DEFAULT_COVERAGE, readCoverage } from '../helpers/coverage.helpers'
import { computeRisk } from '../helpers/risk.helpers'
import { resolve } from 'path'
import { appendSnapshot, buildSnapshot, DEFAULT_HISTORY, readHistory } from '../helpers/trend.helpers'
import { printMetricFiles, printMetricSummary, printRegressions, printViolations } from './report.printer'
import { existsSync, writeFileSync } from 'fs'

export interface MetricBlock {
  metric: string
  summary: MetricInsights
  visible: MetricResult[]
}

export interface CollectedReport {
  report: MetricReport[]
  blocks: MetricBlock[]
  worstSeverity: number
  violations: RuleViolation[]
  context: AnalysisContext | null
}

export const collectReport = async (directory: string): Promise<CollectedReport> => {
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

  return { report, blocks, worstSeverity, violations, context }
}

// Assembles the full material for the dashboard from one analysis pass: findings, git hotspots,
// extraction seams, dependency cycles, cohesion groups, and any recorded history for the trend.
export const assembleDashboardData = (
  directory: string,
  options: RunOptions,
  collected: Pick<CollectedReport, 'report' | 'violations' | 'context'>,
  live: boolean,
): DashboardData => {
  const churn = getChurn(directory, options.since ?? DEFAULT_SINCE)
  const hotspots = churn ? computeHotspots(collected.report, churn) : []
  const seams = collected.context ? computeSeams(collected.context.graph, findCommunities(collected.context.graph)) : []
  const cycles = collected.context ? cyclesFromContext(collected.context) : []
  const cohesion = collected.context ? cohesionFromContext(collected.context) : []
  const config = readConfigSafe()
  // Dead-code detection walks references per export (seconds on big repos). The live dashboard
  // fetches it lazily from /dead when the tab is opened, so only the one-shot static export pays
  // for it here.
  const deadCode = !live && collected.context ? findDeadExports(collected.context, config?.options.deadCode?.entries ?? []) : []
  const coverage = readCoverage(resolve(directory, options.coverage ?? config?.options.coverage ?? DEFAULT_COVERAGE), directory)
  const risk = computeRisk(hotspots, coverage)
  const historyPath = options.record ?? DEFAULT_HISTORY
  const history = existsSync(historyPath) ? readHistory(historyPath) : []

  return {
    report: collected.report,
    violations: collected.violations,
    hotspots,
    generatedAt: new Date().toISOString(),
    live,
    seams,
    history,
    cycles,
    cohesion,
    deadCode,
    risk,
    hasCoverage: coverage.size > 0,
    config,
  }
}

const readConfigSafe = (): ArtieConfig | null => {
  try {
    return readConfig()
  } catch {
    return null
  }
}

// Analyzes a git ref in a temporary detached worktree, using the current config so both sides of a
// comparison are measured the same way. Returns null when the ref cannot be checked out.
export const analyzeRef = async (directory: string, ref: string): Promise<MetricReport[] | null> => {
  const worktree = addWorktree(directory, ref)
  if (!worktree) return null

  try {
    return (await collectReport(worktree)).report
  } finally {
    removeWorktree(directory, worktree)
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

const writeReports = (directory: string, options: RunOptions, collected: CollectedReport): void => {
  if (options.sarif) {
    writeFileSync(options.sarif, JSON.stringify(buildSarif(collected.report, collected.violations), null, 2))
    if (!options.json) console.log(`✓ SARIF written to ${options.sarif}`)
  }
  if (options.html) {
    writeFileSync(options.html, buildDashboard(assembleDashboardData(directory, options, collected, false)))
    if (!options.json) console.log(`✓ HTML dashboard written to ${options.html}`)
  }
}

export const runLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<RunReport> => {
  const collected = await collectReport(directory)
  const { report, blocks, worstSeverity, violations } = collected

  writeReports(directory, options, collected)

  if (options.record) {
    appendSnapshot(options.record, buildSnapshot(report, violations, getCurrentCommit(directory), new Date().toISOString()))
    if (!options.json) console.log(`✓ Snapshot recorded to ${options.record}`)
  }

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

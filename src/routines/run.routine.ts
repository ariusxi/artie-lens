import { MetricInsights, MetricReport, MetricResult, RuleViolation, RunOptions, RunReport } from '../types/config.interface'
import { buildAnalysisContext, metricRegistry, severityRank } from '../helpers/metric.helpers'
import { getEnableMetrics, getMetricIndexes, readConfig, resolveMetricConfig } from '../helpers/config.helpers'
import { computeRegressions, readBaseline, writeBaseline } from '../helpers/baseline.helpers'
import { checkRules } from '../helpers/rule.helpers'
import { buildSarif } from '../helpers/sarif.helpers'
import { buildHtmlReport } from '../helpers/report.html'
import { getCurrentCommit } from '../helpers/git.helpers'
import { appendSnapshot, buildSnapshot } from '../helpers/trend.helpers'
import { printMetricFiles, printMetricSummary, printRegressions, printViolations } from './report.printer'
import { writeFileSync } from 'fs'

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

  return { report, blocks, worstSeverity, violations }
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

const writeReports = (options: RunOptions, report: MetricReport[], violations: RuleViolation[]): void => {
  if (options.sarif) {
    writeFileSync(options.sarif, JSON.stringify(buildSarif(report, violations), null, 2))
    if (!options.json) console.log(`✓ SARIF written to ${options.sarif}`)
  }
  if (options.html) {
    writeFileSync(options.html, buildHtmlReport(report, violations))
    if (!options.json) console.log(`✓ HTML report written to ${options.html}`)
  }
}

export const runLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<RunReport> => {
  const { report, blocks, worstSeverity, violations } = await collectReport(directory)

  writeReports(options, report, violations)

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

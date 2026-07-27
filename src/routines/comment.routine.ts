import { Regression, RunOptions } from '../types/config.interface'
import { severityRank } from '../helpers/metric.helpers'
import { readBaseline, computeRegressions } from '../helpers/baseline.helpers'
import { buildCommentBody, CommentOffender, CommentSummary } from '../helpers/comment.helpers'
import { getPullRequestContext, postStickyComment } from '../helpers/github.helpers'
import { DEFAULT_SINCE, getChurn } from '../helpers/git.helpers'
import { computeHotspots } from '../helpers/hotspot.helpers'
import { collectReport, CollectedReport } from './run.routine'

const OFFENDER_LIMIT = 5
const HOTSPOT_LIMIT = 5

interface Counts {
  criticals: number
  warnings: number
  offenders: CommentOffender[]
}

const countFindings = (report: CollectedReport['report']): Counts => {
  let criticals = 0
  let warnings = 0
  const offenders: CommentOffender[] = []

  for (const metric of report) {
    for (const item of metric.classes) {
      if (item.label === 'CRITICAL') criticals += 1
      if (item.label === 'WARNING') warnings += 1
      if (item.label !== 'OK') offenders.push({ metric: metric.metric, value: item.value, total: item.total, label: item.label })
    }
  }

  offenders.sort((a, b) => severityRank(b.label) - severityRank(a.label) || b.total - a.total)
  return { criticals, warnings, offenders: offenders.slice(0, OFFENDER_LIMIT) }
}

const gateRegressions = (options: RunOptions, report: CollectedReport['report'], worstSeverity: number, hasViolations: boolean): { regressions: Regression[]; failed: boolean } => {
  let failed = hasViolations

  if (options.baseline) {
    const baseline = readBaseline(options.baseline)
    if (!baseline) return { regressions: [], failed }

    const regressions = computeRegressions(baseline, report)
    const gate = options.failOn ? severityRank(options.failOn) : severityRank('WARNING')
    if (regressions.some((item) => severityRank(item.to) >= gate)) failed = true
    return { regressions, failed }
  }

  if (options.failOn && worstSeverity >= severityRank(options.failOn)) failed = true
  return { regressions: [], failed }
}

// Posts (or updates) the PR summary and returns whether the run should fail the build, so the
// same command both gives feedback and gates.
export const commentLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<boolean> => {
  const { report, worstSeverity, violations } = await collectReport(directory)

  const { criticals, warnings, offenders } = countFindings(report)
  const churn = getChurn(directory, options.since ?? DEFAULT_SINCE)
  const hotspots = churn ? computeHotspots(report, churn).slice(0, HOTSPOT_LIMIT) : []
  const { regressions, failed } = gateRegressions(options, report, worstSeverity, violations.length > 0)

  const summary: CommentSummary = { metrics: report.length, criticals, warnings, offenders, hotspots, violations, regressions }

  const context = getPullRequestContext()
  if (!context) {
    console.log('⚠️  No pull request context found (GITHUB_TOKEN and a PR number are required). Skipping comment.')
    return failed
  }

  await postStickyComment(context, buildCommentBody(summary))
  console.log('✓ Posted the artie-lens summary to the pull request.')
  return failed
}

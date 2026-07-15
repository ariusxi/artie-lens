import { Regression, RunOptions } from '../types/config.interface'
import { severityRank } from '../helpers/metric.helpers'
import { readBaseline, computeRegressions } from '../helpers/baseline.helpers'
import { buildCommentBody } from '../helpers/comment.helpers'
import { getPullRequestContext, postStickyComment } from '../helpers/github.helpers'
import { collectReport } from './run.routine'

// Posts (or updates) the PR summary and returns whether the run should fail the build, so the
// same command both gives feedback and gates.
export const commentLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<boolean> => {
  const { report, worstSeverity, violations } = await collectReport(directory)

  let regressions: Regression[] = []
  let failed = violations.length > 0

  if (options.baseline) {
    const baseline = readBaseline(options.baseline)
    if (baseline) {
      regressions = computeRegressions(baseline, report)
      const gate = options.failOn ? severityRank(options.failOn) : severityRank('WARNING')
      if (regressions.some((item) => severityRank(item.to) >= gate)) failed = true
    }
  }

  if (!options.baseline && options.failOn) {
    if (worstSeverity >= severityRank(options.failOn)) failed = true
  }

  const context = getPullRequestContext()
  if (!context) {
    console.log('⚠️  No pull request context found (GITHUB_TOKEN and a PR number are required). Skipping comment.')
    return failed
  }

  await postStickyComment(context, buildCommentBody(regressions, violations))
  console.log('✓ Posted the artie-lens summary to the pull request.')
  return failed
}

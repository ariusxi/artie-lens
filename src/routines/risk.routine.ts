import { resolve } from 'path'

import { RunOptions } from '../types/config.interface'
import { readConfig } from '../helpers/config.helpers'
import { DEFAULT_SINCE, getChurn } from '../helpers/git.helpers'
import { computeHotspots } from '../helpers/hotspot.helpers'
import { DEFAULT_COVERAGE, readCoverage } from '../helpers/coverage.helpers'
import { computeRisk } from '../helpers/risk.helpers'
import { printMetric } from '../helpers/print.helpers'
import { collectReport } from './run.routine'

const RISK_LIMIT = 15

export const resolveCoveragePath = (directory: string, options: RunOptions, configured?: string): string =>
  resolve(directory, options.coverage ?? configured ?? DEFAULT_COVERAGE)

export const riskLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<void> => {
  const churn = getChurn(directory, options.since ?? DEFAULT_SINCE)
  if (!churn) return console.log('⚠️  Not a git repository. Risk weights hotspots, which need churn.')

  const config = readConfig()
  const coveragePath = resolveCoveragePath(directory, options, config.options.coverage)
  const coverage = readCoverage(coveragePath, directory)
  if (!coverage.size) return console.log(`⚠️  No coverage found at ${coveragePath}. Generate an lcov report (e.g. vitest run --coverage) or set options.coverage.`)

  const { report } = await collectReport(directory)
  const risk = computeRisk(computeHotspots(report, churn), coverage)

  if (options.json) return console.log(JSON.stringify({ risk }, null, 2))
  if (!risk.length) return console.log('✓ No risky hotspots. Nothing complex and churned is under-tested.')

  console.log('🎯 Risk (hotspots weighted by missing test coverage)\n')
  for (const item of risk.slice(0, RISK_LIMIT)) {
    const coveredText = item.coverage === null ? 'no coverage' : `${item.coverage.toFixed(0)}% covered`
    const label = item.badness >= 3 ? 'CRITICAL' : 'WARNING'
    printMetric(`[risk ${item.risk}] ${item.file}  (score ${item.score}, ${item.churn} changes, ${coveredText})`, label)
  }
}

import { existsSync, readFileSync, writeFileSync } from 'fs'

import { MetricReport, RuleViolation, Snapshot } from '../types/config.interface'

export const DEFAULT_HISTORY = '.artie-history.json'

export const buildSnapshot = (report: MetricReport[], violations: RuleViolation[], commit: string, at: string): Snapshot => {
  let warnings = 0
  let criticals = 0

  for (const metric of report) {
    for (const item of metric.classes) {
      if (item.label === 'CRITICAL') {
        criticals += 1
        continue
      }
      if (item.label === 'WARNING') warnings += 1
    }
  }

  return { at, commit, warnings, criticals, violations: violations.length }
}

export const readHistory = (path: string): Snapshot[] => {
  if (!existsSync(path)) return []

  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return []
  }
}

export const appendSnapshot = (path: string, snapshot: Snapshot): void => {
  const history = readHistory(path)
  history.push(snapshot)
  writeFileSync(path, JSON.stringify(history, null, 2))
}

// A single weighted number so consecutive runs can be compared: criticals dominate.
export const snapshotScore = (snapshot: Snapshot): number =>
  snapshot.criticals * 3 + snapshot.warnings + snapshot.violations

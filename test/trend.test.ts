import { describe, expect, it } from 'vitest'

import { buildSnapshot, snapshotScore } from '../src/helpers/trend.helpers'
import { MetricReport, RuleViolation } from '../src/types/config.interface'

const summary = { total: 0, max: 0, min: 0, average: '0', deviation: '0' }

const cls = (label: string) => ({ value: 'X', total: 1, label })

const report: MetricReport[] = [
  { metric: 'wmc', summary, classes: [cls('CRITICAL'), cls('WARNING'), cls('OK')] },
  { metric: 'cbo', summary, classes: [cls('WARNING')] },
]

const violations: RuleViolation[] = [{ from: 'a', to: 'b', message: 'no' }]

describe('buildSnapshot', () => {
  it('counts warnings, criticals and violations at the given commit and time', () => {
    const snapshot = buildSnapshot(report, violations, 'abc1234', '2026-01-10T00:00:00Z')

    expect(snapshot).toEqual({ at: '2026-01-10T00:00:00Z', commit: 'abc1234', warnings: 2, criticals: 1, violations: 1 })
  })
})

describe('snapshotScore', () => {
  it('weights criticals above warnings and violations', () => {
    const score = snapshotScore({ at: '', commit: '', warnings: 2, criticals: 1, violations: 1 })
    expect(score).toBe(1 * 3 + 2 + 1)
  })
})

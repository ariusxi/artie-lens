import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import { assembleDashboardData } from '../src/routines/run.routine'
import { buildDashboardModel } from '../src/helpers/report.dashboard'
import { MetricReport, RuleViolation, Snapshot } from '../src/types/config.interface'

const summary = { total: 0, max: 0, min: 0, average: '0', deviation: '0' }

const report: MetricReport[] = [
  { metric: 'wmc', summary, classes: [{ value: 'OrderService', total: 30, label: 'CRITICAL', file: 'src/order.ts' }] },
]
const violations: RuleViolation[] = [{ from: 'src/a.ts', to: 'src/b.ts', message: 'no' }]
const history: Snapshot[] = [
  { at: '2026-01-01T00:00:00Z', commit: 'a', warnings: 3, criticals: 1, violations: 0 },
  { at: '2026-01-02T00:00:00Z', commit: 'b', warnings: 2, criticals: 1, violations: 1 },
]

describe('assembleDashboardData', () => {
  it('wires the report, live flag and recorded history, and stays empty without a context or repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'artie-'))
    const recordPath = join(dir, 'history.json')
    writeFileSync(recordPath, JSON.stringify(history))

    const data = assembleDashboardData(dir, { record: recordPath }, { report, violations, context: null }, true)

    expect(data.live).toBe(true)
    expect(data.report).toBe(report)
    expect(data.violations).toBe(violations)
    expect(data.history).toHaveLength(2)
    // No analysis context and no git repository, so the derived sections are empty rather than absent.
    expect(data.hotspots).toEqual([])
    expect(data.seams).toEqual([])
    expect(data.cycles).toEqual([])
    expect(data.cohesion).toEqual([])
    expect(new Date(data.generatedAt).toISOString()).toBe(data.generatedAt)
  })

  it('feeds the history through to the model so the trend sparkline has data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'artie-'))
    const recordPath = join(dir, 'history.json')
    writeFileSync(recordPath, JSON.stringify(history))

    const model = buildDashboardModel(assembleDashboardData(dir, { record: recordPath }, { report, violations, context: null }, false))

    expect(model.history).toHaveLength(2)
    expect(model.kpis.criticals).toBe(1)
    expect(model.failed).toBe(true)
  })
})

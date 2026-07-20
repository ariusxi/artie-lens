import { describe, expect, it } from 'vitest'

import { buildSarif } from '../src/helpers/sarif.helpers'
import { buildDashboard } from '../src/helpers/report.dashboard'
import { MetricReport, RuleViolation } from '../src/types/config.interface'

const dashboard = (report: MetricReport[], violations: RuleViolation[], live = false) =>
  buildDashboard({ report, violations, hotspots: [], generatedAt: '2026-01-01T00:00:00Z', live })

const summary = { total: 0, max: 0, min: 0, average: '0', deviation: '0' }

const report: MetricReport[] = [
  {
    metric: 'wmc',
    summary,
    classes: [
      { value: 'OrderService', total: 30, label: 'CRITICAL', file: 'src/order.ts' },
      { value: 'Ok', total: 2, label: 'OK', file: 'src/ok.ts' },
    ],
  },
]

const violations: RuleViolation[] = [{ from: 'src/domain/a.ts', to: 'src/infra/b.ts', message: 'no' }]

describe('buildSarif', () => {
  it('emits a valid SARIF shell with one result per non-OK finding', () => {
    const sarif = JSON.parse(JSON.stringify(buildSarif(report, violations))) as any

    expect(sarif.version).toBe('2.1.0')
    expect(sarif.runs[0].tool.driver.name).toBe('artie-lens')

    const results = sarif.runs[0].results
    expect(results).toHaveLength(2) // the CRITICAL class and the violation, not the OK class
    expect(results[0]).toMatchObject({ ruleId: 'wmc', level: 'error' })
    expect(results[0].locations[0].physicalLocation.artifactLocation.uri).toBe('src/order.ts')
    expect(results[1].ruleId).toBe('architecture-rule')
  })

  it('maps WARNING to warning and CRITICAL to error', () => {
    const warned = buildSarif([{ metric: 'cbo', summary, classes: [{ value: 'X', total: 9, label: 'WARNING', file: 'x.ts' }] }], []) as any
    expect(warned.runs[0].results[0].level).toBe('warning')
  })
})

describe('buildDashboard', () => {
  it('renders a self-contained dashboard with KPIs and the flagged findings', () => {
    const html = dashboard(report, violations)

    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('artie-lens')
    expect(html).toContain('Worst offenders')
    expect(html).toContain('OrderService')
    expect(html).toContain('Architecture violations')
    expect(html).toContain('needs attention') // failed status because there is a CRITICAL and a violation
  })

  it('shows a healthy status and no live script when clean and not live', () => {
    const html = dashboard([{ metric: 'wmc', summary, classes: [{ value: 'Ok', total: 1, label: 'OK', file: 'x.ts' }] }], [])

    expect(html).toContain('healthy')
    expect(html).not.toContain('EventSource')
  })

  it('injects the live-reload script when live', () => {
    expect(dashboard(report, violations, true)).toContain('EventSource')
  })
})

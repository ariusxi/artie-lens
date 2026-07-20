import { describe, expect, it } from 'vitest'

import { buildSarif } from '../src/helpers/sarif.helpers'
import { buildHtmlReport } from '../src/helpers/report.html'
import { MetricReport, RuleViolation } from '../src/types/config.interface'

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

describe('buildHtmlReport', () => {
  it('renders a self-contained document with the flagged findings', () => {
    const html = buildHtmlReport(report, violations)

    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('OrderService')
    expect(html).toContain('CRITICAL')
    expect(html).toContain('Architecture violations')
    expect(html).not.toContain('>Ok<') // OK classes are not listed
  })

  it('reports a clean result when there is nothing to flag', () => {
    const html = buildHtmlReport([{ metric: 'wmc', summary, classes: [{ value: 'Ok', total: 1, label: 'OK', file: 'x.ts' }] }], [])
    expect(html).toContain('No warnings, criticals or violations')
  })
})

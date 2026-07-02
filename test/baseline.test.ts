import { describe, expect, it } from 'vitest'

import { computeRegressions } from '../src/helpers/baselineHelpers'
import { MetricReport, MetricResult } from '../src/types/config.interface'

const summary = { total: 0, max: 0, min: 0, average: '0', deviation: '0' }

const cls = (value: string, total: number, label: string): MetricResult => ({ value, total, label })

const report = (metric: string, classes: MetricResult[]): MetricReport => ({ metric, summary, classes })

describe('computeRegressions', () => {
  it('flags severity increases and new offending classes, ignoring the rest', () => {
    const baseline = [
      report('wmc', [
        cls('A', 2, 'OK'),
        cls('B', 12, 'WARNING'),
        cls('C', 12, 'WARNING'),
        cls('D', 2, 'OK'),
        cls('G', 40, 'CRITICAL'),
      ]),
    ]

    const current = [
      report('wmc', [
        cls('A', 12, 'WARNING'),   // OK -> WARNING (regression)
        cls('B', 30, 'CRITICAL'),  // WARNING -> CRITICAL (regression)
        cls('C', 13, 'WARNING'),   // WARNING -> WARNING (value up, not a regression)
        cls('D', 4, 'OK'),         // OK -> OK (not a regression)
        cls('E', 40, 'CRITICAL'),  // new CRITICAL (regression)
        cls('F', 1, 'OK'),         // new OK (not a regression)
        cls('G', 2, 'OK'),         // CRITICAL -> OK improvement (not a regression)
      ]),
    ]

    const regressions = computeRegressions(baseline, current)
    const values = regressions.map((item) => item.value).sort()

    expect(values).toEqual(['A', 'B', 'E'])
    expect(regressions.find((item) => item.value === 'E')?.from).toBe('NEW')
    expect(regressions.find((item) => item.value === 'B')).toMatchObject({ from: 'WARNING', to: 'CRITICAL', toTotal: 30 })
  })

  it('scopes comparisons per metric', () => {
    const baseline = [report('wmc', [cls('A', 2, 'OK')]), report('cbo', [cls('A', 2, 'OK')])]
    const current = [report('wmc', [cls('A', 2, 'OK')]), report('cbo', [cls('A', 9, 'WARNING')])]

    const regressions = computeRegressions(baseline, current)

    expect(regressions).toHaveLength(1)
    expect(regressions[0]).toMatchObject({ metric: 'cbo', value: 'A', to: 'WARNING' })
  })

  it('returns nothing when everything is stable or improved', () => {
    const baseline = [report('wmc', [cls('A', 12, 'WARNING'), cls('B', 30, 'CRITICAL')])]
    const current = [report('wmc', [cls('A', 12, 'WARNING'), cls('B', 2, 'OK')])]

    expect(computeRegressions(baseline, current)).toHaveLength(0)
  })
})

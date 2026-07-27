import { describe, expect, it } from 'vitest'

import { compareReports } from '../src/helpers/compare.helpers'
import { MetricReport, MetricResult } from '../src/types/config.interface'

const summary = { total: 0, max: 0, min: 0, average: '0', deviation: '0' }
const cls = (value: string, total: number, label: string): MetricResult => ({ value, total, label, file: `${value}.ts` })
const wmc = (classes: MetricResult[]): MetricReport[] => [{ metric: 'wmc', summary, classes }]

const base = wmc([cls('A', 12, 'WARNING'), cls('B', 25, 'CRITICAL'), cls('C', 3, 'OK'), cls('E', 10, 'CRITICAL')])
const head = wmc([cls('A', 21, 'CRITICAL'), cls('B', 2, 'OK'), cls('C', 3, 'OK'), cls('D', 9, 'WARNING')])

describe('compareReports', () => {
  const comparison = compareReports(base, head, 'main')
  const change = (value: string) => comparison.deltas.find((delta) => delta.value === value)

  it('counts each side and echoes the ref', () => {
    expect(comparison.ref).toBe('main')
    expect(comparison.base).toEqual({ criticals: 2, warnings: 1 })
    expect(comparison.head).toEqual({ criticals: 1, warnings: 1 })
  })

  it('classifies every meaningful move and ignores unchanged OK classes', () => {
    expect(change('A')!.change).toBe('worse') // WARNING -> CRITICAL
    expect(change('B')!.change).toBe('better') // CRITICAL -> OK
    expect(change('D')!.change).toBe('new') // absent -> WARNING
    expect(change('E')!.change).toBe('gone') // CRITICAL -> absent
    expect(change('C')).toBeUndefined() // OK -> OK
  })

  it('orders worse and new findings before improvements', () => {
    expect(comparison.deltas.map((delta) => delta.change)).toEqual(['worse', 'new', 'better', 'gone'])
  })
})

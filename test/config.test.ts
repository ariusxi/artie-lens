import { describe, expect, it } from 'vitest'

import { getEnableMetrics, getMetricIndexes } from '../src/helpers/configHelpers'
import { getMetricLabel } from '../src/helpers/metricHelpers'
import { ArtieConfig, MetricResult } from '../src/types/config.interface'

const result = (total: number): MetricResult => ({ total, label: 'OK', value: 'X' })

describe('getMetricLabel', () => {
  const config = { warning: 10, critical: 20 }

  it('returns OK below the warning threshold', () => {
    expect(getMetricLabel(5, config)).toBe('OK')
  })

  it('returns WARNING at or above the warning threshold', () => {
    expect(getMetricLabel(10, config)).toBe('WARNING')
    expect(getMetricLabel(19, config)).toBe('WARNING')
  })

  it('returns CRITICAL at or above the critical threshold', () => {
    expect(getMetricLabel(20, config)).toBe('CRITICAL')
    expect(getMetricLabel(50, config)).toBe('CRITICAL')
  })
})

describe('getMetricIndexes', () => {
  it('computes total, max, min, average and deviation', () => {
    const indexes = getMetricIndexes([result(2), result(4), result(6)])

    expect(indexes.total).toBe(12)
    expect(indexes.max).toBe(6)
    expect(indexes.min).toBe(2)
    expect(indexes.average).toBe('4.00')
    expect(indexes.deviation).toBe('1.63')
  })

  it('returns zeros for an empty result set', () => {
    expect(getMetricIndexes([])).toEqual({
      total: 0,
      max: 0,
      min: 0,
      average: '0',
      deviation: '0',
    })
  })
})

describe('getEnableMetrics', () => {
  it('returns only the enabled metric keys', () => {
    const config = {
      options: {
        defaultThresholds: {},
        metrics: {
          wmc: { enabled: true },
          cbo: { enabled: false },
          rfc: { enabled: true },
          lcom: { enabled: true },
        },
      },
    } as ArtieConfig

    expect(getEnableMetrics(config)).toEqual(['wmc', 'rfc', 'lcom'])
  })
})

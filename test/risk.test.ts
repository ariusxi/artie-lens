import { describe, expect, it } from 'vitest'

import { parseLcov } from '../src/helpers/coverage.helpers'
import { computeRisk } from '../src/helpers/risk.helpers'
import { Hotspot } from '../src/types/config.interface'

const hotspot = (file: string, churn: number, badness: number): Hotspot =>
  ({ file, churn, badness, score: churn * badness, findings: [`finding in ${file}`] })

describe('parseLcov', () => {
  it('reads per-file percentages from LF/LH totals', () => {
    const coverage = parseLcov('SF:src/a.ts\nLF:100\nLH:75\nend_of_record\n')
    expect(coverage.get('src/a.ts')).toMatchObject({ pct: 75 })
  })

  it('falls back to counting DA records when totals are absent', () => {
    const coverage = parseLcov('SF:src/b.ts\nDA:1,3\nDA:2,0\nDA:3,1\nDA:4,0\nend_of_record\n')
    expect(coverage.get('src/b.ts')!.pct).toBe(50) // 2 of 4 lines hit
  })
})

describe('computeRisk', () => {
  const coverage = new Map<string, number>([['src/hot.ts', 20], ['src/safe.ts', 95]])

  it('weights each hotspot by its uncovered fraction and ranks them', () => {
    const risk = computeRisk([hotspot('src/hot.ts', 10, 3), hotspot('src/safe.ts', 10, 3)], coverage)

    const hot = risk.find((item) => item.file === 'src/hot.ts')!
    const safe = risk.find((item) => item.file === 'src/safe.ts')!
    expect(hot.risk).toBe(24) // score 30 × (1 - 0.20)
    expect(safe.risk).toBe(1.5) // score 30 × (1 - 0.95)
    expect(risk[0].file).toBe('src/hot.ts') // higher risk first
  })

  it('treats a file missing from coverage as fully uncovered', () => {
    const [item] = computeRisk([hotspot('src/untested.ts', 4, 3)], coverage)
    expect(item.coverage).toBeNull()
    expect(item.risk).toBe(12) // full score, nothing mitigated
  })
})

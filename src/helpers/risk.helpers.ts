import { Hotspot, RiskItem } from '../types/config.interface'

// Risk is a hotspot weighted by how much of it is untested: a file that is complex AND churned AND
// uncovered floats to the top, while a well-tested hotspot drops toward zero. A file absent from
// the coverage report is treated as fully uncovered (its risk is unmitigated).
export const computeRisk = (hotspots: Hotspot[], coverage: Map<string, number>): RiskItem[] =>
  hotspots
    .map((hotspot) => {
      const pct = coverage.has(hotspot.file) ? coverage.get(hotspot.file)! : null
      const uncovered = pct === null ? 1 : 1 - pct / 100
      return {
        file: hotspot.file,
        churn: hotspot.churn,
        badness: hotspot.badness,
        score: hotspot.score,
        coverage: pct,
        risk: Math.round(hotspot.score * uncovered * 10) / 10,
        findings: hotspot.findings,
      }
    })
    .sort((a, b) => b.risk - a.risk)

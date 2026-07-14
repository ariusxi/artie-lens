import { Hotspot, MetricReport } from '../types/config.interface'

// A clean file adds nothing, a WARNING adds a little, a CRITICAL dominates.
const SEVERITY_WEIGHT: Record<string, number> = { OK: 0, WARNING: 1, CRITICAL: 3 }

export const HOTSPOT_LIMIT = 10

interface FileFindings {
  badness: number
  findings: string[]
}

const collectFindingsByFile = (report: MetricReport[]): Map<string, FileFindings> => {
  const byFile = new Map<string, FileFindings>()

  for (const metric of report) {
    for (const item of metric.classes) {
      const file = item.file
      const weight = SEVERITY_WEIGHT[item.label] ?? 0
      if (!file || weight === 0) continue

      if (!byFile.has(file)) byFile.set(file, { badness: 0, findings: [] })

      const entry = byFile.get(file)!
      entry.badness += weight
      entry.findings.push(`${metric.metric.toUpperCase()} ${item.label} ${item.value} (${item.total})`)
    }
  }

  return byFile
}

// Structural badness alone says what is bad. Churn says what is alive. A hotspot is both:
// a file that is unhealthy AND actively being changed.
export const computeHotspots = (report: MetricReport[], churn: Map<string, number>): Hotspot[] => {
  const byFile = collectFindingsByFile(report)
  const hotspots: Hotspot[] = []

  for (const [file, { badness, findings }] of byFile) {
    const changes = churn.get(file) ?? 0
    const score = changes * badness
    if (score === 0) continue

    hotspots.push({ file, churn: changes, badness, score, findings })
  }

  return hotspots.sort((a, b) => b.score - a.score || b.churn - a.churn)
}

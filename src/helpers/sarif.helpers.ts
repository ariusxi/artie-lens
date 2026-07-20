import { MetricReport, RuleViolation } from '../types/config.interface'

const SARIF_LEVEL: Record<string, string> = { WARNING: 'warning', CRITICAL: 'error' }

const ARCHITECTURE_RULE = 'architecture-rule'

// Builds a SARIF 2.1.0 document so the findings show up in the GitHub Code Scanning tab.
export const buildSarif = (report: MetricReport[], violations: RuleViolation[]): object => {
  const results = []

  for (const metric of report) {
    for (const item of metric.classes) {
      const level = SARIF_LEVEL[item.label]
      if (!level) continue

      results.push({
        ruleId: metric.metric,
        level,
        message: { text: `${metric.metric.toUpperCase()} is ${item.total} on ${item.value}` },
        locations: item.file ? [{ physicalLocation: { artifactLocation: { uri: item.file } } }] : [],
      })
    }
  }

  for (const violation of violations) {
    results.push({
      ruleId: ARCHITECTURE_RULE,
      level: 'error',
      message: { text: `${violation.from} imports ${violation.to}: ${violation.message}` },
      locations: [{ physicalLocation: { artifactLocation: { uri: violation.from } } }],
    })
  }

  const rules = [...new Set(report.map((metric) => metric.metric)), ARCHITECTURE_RULE].map((id) => ({ id, name: id }))

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'artie-lens',
            informationUri: 'https://github.com/ariusxi/artie-lens',
            rules,
          },
        },
        results,
      },
    ],
  }
}

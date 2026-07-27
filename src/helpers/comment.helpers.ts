import { Hotspot, Regression, RuleViolation } from '../types/config.interface'

// A hidden marker so the comment can be found and updated instead of duplicated on each push.
export const COMMENT_MARKER = '<!-- artie-lens-comment -->'

export interface CommentOffender {
  metric: string
  value: string
  total: number
  label: string
}

export interface CommentSummary {
  metrics: number
  criticals: number
  warnings: number
  offenders: CommentOffender[]
  hotspots: Hotspot[]
  violations: RuleViolation[]
  regressions: Regression[]
}

const SEVERITY_ICON: Record<string, string> = { CRITICAL: '🔴', WARNING: '🟡' }

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

export const buildCommentBody = (summary: CommentSummary): string => {
  const lines = [COMMENT_MARKER, '## 🔍 artie-lens', '']
  const clean = summary.criticals === 0 && summary.warnings === 0 && summary.violations.length === 0 && summary.regressions.length === 0

  if (clean) {
    lines.push(`✅ Clean: no criticals, warnings or violations across ${summary.metrics} metrics.`)
    return lines.join('\n')
  }

  lines.push(`**${plural(summary.criticals, 'critical')}**, **${plural(summary.warnings, 'warning')}**, **${plural(summary.violations.length, 'violation')}** across ${summary.metrics} metrics.`)

  if (summary.offenders.length) {
    lines.push('', '**Worst offenders**')
    for (const offender of summary.offenders) {
      lines.push(`- ${SEVERITY_ICON[offender.label] ?? ''} ${offender.metric.toUpperCase()} \`${offender.value}\`: ${offender.total}`)
    }
  }

  if (summary.hotspots.length) {
    lines.push('', '**Top hotspots** (complexity crossed with churn)')
    for (const hotspot of summary.hotspots) {
      lines.push(`- \`${hotspot.file}\`: score ${hotspot.score} (${hotspot.churn} changes)`)
    }
  }

  if (summary.violations.length) {
    lines.push('', `### Architecture violations (${summary.violations.length})`)
    for (const violation of summary.violations) {
      lines.push(`- \`${violation.from}\` → \`${violation.to}\`: ${violation.message}`)
    }
  }

  if (summary.regressions.length) {
    lines.push('', `### Regressions vs baseline (${summary.regressions.length})`)
    for (const item of summary.regressions) {
      lines.push(`- **${item.to}** ${item.metric.toUpperCase()} \`${item.value}\`: ${item.from} ${item.fromTotal} → ${item.to} ${item.toTotal}`)
    }
  }

  return lines.join('\n')
}

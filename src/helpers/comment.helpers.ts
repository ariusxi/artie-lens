import { Regression, RuleViolation } from '../types/config.interface'

// A hidden marker so the comment can be found and updated instead of duplicated on each push.
export const COMMENT_MARKER = '<!-- artie-lens-comment -->'

export const buildCommentBody = (regressions: Regression[], violations: RuleViolation[]): string => {
  const lines = [COMMENT_MARKER, '## 🔍 artie-lens', '']
  const total = regressions.length + violations.length

  if (total === 0) {
    lines.push('✅ No new regressions or architecture violations.')
    return lines.join('\n')
  }

  lines.push(`❌ ${total} issue(s) to review.`)

  if (violations.length) {
    lines.push('', `### Architecture violations (${violations.length})`)
    for (const violation of violations) {
      lines.push(`- \`${violation.from}\` → \`${violation.to}\`: ${violation.message}`)
    }
  }

  if (regressions.length) {
    lines.push('', `### Regressions vs baseline (${regressions.length})`)
    for (const item of regressions) {
      lines.push(`- **${item.to}** ${item.metric.toUpperCase()} \`${item.value}\`: ${item.from} ${item.fromTotal} → ${item.to} ${item.toTotal}`)
    }
  }

  return lines.join('\n')
}

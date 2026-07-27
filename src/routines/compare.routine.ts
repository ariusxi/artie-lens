import { RunOptions } from '../types/config.interface'
import { ChangeKind, compareReports, MetricDelta } from '../helpers/compare.helpers'
import { printMetric } from '../helpers/print.helpers'
import { analyzeRef, collectReport } from './run.routine'

const DEFAULT_REF = 'main'

const HEADINGS: Record<ChangeKind, string> = {
  worse: '🔺 Worsened',
  new: '🆕 New findings',
  better: '🔻 Improved',
  gone: '✅ Resolved',
}

const arrow = (delta: MetricDelta): string => {
  const from = delta.fromLabel ? `${delta.fromLabel} ${delta.fromTotal}` : 'absent'
  const to = delta.toLabel ? `${delta.toLabel} ${delta.toTotal}` : 'absent'
  return `${from} → ${to}`
}

export const compareLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<void> => {
  const ref = options.against ?? DEFAULT_REF
  const base = await analyzeRef(directory, ref)
  if (!base) return console.log(`⚠️  Could not analyze "${ref}". Check that it is a valid git ref and that you are inside the repository.`)

  const head = (await collectReport(directory)).report
  const comparison = compareReports(base, head, ref)

  if (options.json) return console.log(JSON.stringify(comparison, null, 2))

  console.log(`🔀 Comparison vs ${ref}\n`)
  console.log(`   criticals: ${comparison.base.criticals} → ${comparison.head.criticals}    warnings: ${comparison.base.warnings} → ${comparison.head.warnings}\n`)

  if (!comparison.deltas.length) return console.log('No differences in the findings.')

  const kinds: ChangeKind[] = ['worse', 'new', 'better', 'gone']
  for (const kind of kinds) {
    const group = comparison.deltas.filter((delta) => delta.change === kind)
    if (!group.length) continue

    console.log(`${HEADINGS[kind]} (${group.length})`)
    for (const delta of group) {
      const label = kind === 'worse' || kind === 'new' ? 'CRITICAL' : 'OK'
      printMetric(`   ${delta.metric.toUpperCase()} ${delta.value}: ${arrow(delta)}`, label)
    }
    console.log('')
  }
}

import { RunOptions } from '../types/config.interface'
import { printMetric } from '../helpers/print.helpers'
import { DEFAULT_HISTORY, readHistory, snapshotScore } from '../helpers/trend.helpers'

const TREND_LIMIT = 15

const TREND_LABEL: Record<string, string> = { '-1': '▼ improving', '0': '= flat', '1': '▲ worse' }
const TREND_SEVERITY: Record<string, string> = { '-1': 'OK', '0': 'WARNING', '1': 'CRITICAL' }

export const trendLens = (directory = process.cwd(), options: RunOptions = {}): void => {
  const path = options.record ?? DEFAULT_HISTORY
  const history = readHistory(path)

  if (history.length === 0) return console.log(`No history in ${path}. Run \`artie run --record\` to start recording.`)

  console.log(`📈 Trend (${path}, ${history.length} records)\n`)

  const recent = history.slice(-TREND_LIMIT)
  recent.forEach((snapshot, index) => {
    const date = snapshot.at.slice(0, 10)
    const line = `${date}  ${snapshot.commit.padEnd(9)}  ${snapshot.warnings} warnings · ${snapshot.criticals} criticals · ${snapshot.violations} violations`

    const previous = recent[index - 1]
    if (!previous) return console.log(`   ${line}`)

    const sign = String(Math.sign(snapshotScore(snapshot) - snapshotScore(previous)))
    printMetric(`   ${line}   ${TREND_LABEL[sign]}`, TREND_SEVERITY[sign])
  })
}

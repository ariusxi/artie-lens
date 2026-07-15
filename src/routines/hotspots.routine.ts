import { RunOptions } from '../types/config.interface'
import { printMetric } from '../helpers/print.helpers'
import { DEFAULT_SINCE, getChurn } from '../helpers/git.helpers'
import { computeHotspots, HOTSPOT_LIMIT } from '../helpers/hotspot.helpers'
import { collectReport } from './run.routine'

export const hotspotLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<void> => {
  const since = options.since ?? DEFAULT_SINCE
  const churn = getChurn(directory, since)

  if (!churn) return console.log('⚠️  Not a git repository. Hotspots need commit history to measure churn.')

  const { report } = await collectReport(directory)
  const hotspots = computeHotspots(report, churn)

  if (options.json) return console.log(JSON.stringify({ since, hotspots }, null, 2))

  console.log(`🔥 Hotspots (structural issues in files actually being changed, since ${since})\n`)

  if (hotspots.length === 0) return console.log('No hotspots. Either the changed files are healthy, or the unhealthy ones are not being touched.')

  for (const hotspot of hotspots.slice(0, HOTSPOT_LIMIT)) {
    const label = hotspot.findings.some((finding) => finding.includes('CRITICAL')) ? 'CRITICAL' : 'WARNING'
    printMetric(`[score ${hotspot.score}] ${hotspot.file}  (${hotspot.churn} changes × badness ${hotspot.badness})`, label)
    for (const finding of hotspot.findings) console.log(`     ${finding}`)
    console.log('')
  }
}

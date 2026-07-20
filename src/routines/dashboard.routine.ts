import { createServer, ServerResponse } from 'http'
import { watch } from 'chokidar'

import { RunOptions } from '../types/config.interface'
import { DEFAULT_SINCE, getChurn } from '../helpers/git.helpers'
import { computeHotspots } from '../helpers/hotspot.helpers'
import { buildDashboard } from '../helpers/report.dashboard'
import { collectReport } from './run.routine'

const DEFAULT_PORT = 4300
const WATCH_DEBOUNCE_MS = 300

export const dashboardLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<void> => {
  const port = Number(options.port) || DEFAULT_PORT
  const clients: ServerResponse[] = []
  let html = ''

  const render = async (): Promise<void> => {
    const { report, violations } = await collectReport(directory)
    const churn = getChurn(directory, DEFAULT_SINCE)
    const hotspots = churn ? computeHotspots(report, churn) : []

    html = buildDashboard({ report, violations, hotspots, generatedAt: new Date().toISOString(), live: true })
    for (const client of clients) client.write('data: update\n\n')
  }

  await render()

  const server = createServer((request, response) => {
    if (request.url === '/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
      response.write('\n')
      clients.push(response)
      request.on('close', () => clients.splice(clients.indexOf(response), 1))
      return
    }

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(html)
  })

  server.listen(port, () => console.log(`🔍 artie-lens dashboard on http://localhost:${port}  (watching for changes, Ctrl+C to stop)`))

  let timer: ReturnType<typeof setTimeout> | undefined
  const watcher = watch(directory, {
    ignored: (path) => path.includes('node_modules') || path.includes('/.git/'),
    ignoreInitial: true,
  })

  watcher.on('all', (_event, path) => {
    if (!path.endsWith('.ts')) return
    clearTimeout(timer)
    timer = setTimeout(() => render().catch((error) => console.error(error)), WATCH_DEBOUNCE_MS)
  })
}

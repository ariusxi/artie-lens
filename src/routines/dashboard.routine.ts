import { createServer, IncomingMessage, ServerResponse } from 'http'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { watch } from 'chokidar'

import { RunOptions } from '../types/config.interface'
import { assertConfigShape, getConfigPath, writeConfig } from '../helpers/config.helpers'
import { buildDashboard, buildDashboardModel } from '../helpers/report.dashboard'
import { assembleDashboardData, collectReport } from './run.routine'

const DEFAULT_PORT = 4300
const WATCH_DEBOUNCE_MS = 300
const MAX_BODY_BYTES = 1_000_000

const readBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > MAX_BODY_BYTES) reject(new Error('Config payload too large.'))
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })

export const dashboardLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<void> => {
  const port = Number(options.port) || DEFAULT_PORT
  const clients: ServerResponse[] = []
  let html = ''

  const render = async (): Promise<void> => {
    const collected = await collectReport(directory)
    const data = assembleDashboardData(directory, options, collected, true)

    html = buildDashboard(data)
    const payload = JSON.stringify(buildDashboardModel(data))
    for (const client of clients) client.write(`data: ${payload}\n\n`)
  }

  // Persists the edited config, re-analyzes, and streams the new model to every client. If the new
  // config cannot be analyzed, the previous file is restored so a bad edit never breaks the server.
  const applyConfig = async (request: IncomingMessage): Promise<void> => {
    const parsed = assertConfigShape(JSON.parse(await readBody(request)))
    const configPath = getConfigPath()
    const previous = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : null

    writeConfig(parsed)
    try {
      await render()
    } catch (error) {
      if (previous !== null) writeFileSync(configPath, previous)
      throw error
    }
  }

  await render()

  const server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/config') {
      try {
        await applyConfig(request)
        response.writeHead(204).end()
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

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

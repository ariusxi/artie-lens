import { createServer, IncomingMessage, ServerResponse } from 'http'
import { randomBytes, timingSafeEqual } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, resolve } from 'path'
import { watch } from 'chokidar'

import { RunOptions } from '../types/config.interface'
import { assertConfigShape, getConfigPath, readConfig, writeConfig } from '../helpers/config.helpers'
import { buildAnalysisContext } from '../helpers/metric.helpers'
import { findDeadExports } from '../helpers/dead.helpers'
import { compareReports } from '../helpers/compare.helpers'
import { createLatestRunQueue } from '../helpers/run-queue.helpers'
import { buildDashboard, buildDashboardModel } from '../helpers/report.dashboard'
import { DEFAULT_COVERAGE } from '../helpers/coverage.helpers'
import { DEFAULT_HISTORY } from '../helpers/trend.helpers'
import { analyzeRef, assembleDashboardData, collectReport } from './run.routine'

const DEFAULT_PORT = 4300
const WATCH_DEBOUNCE_MS = 300
const MAX_BODY_BYTES = 1_000_000
const LOOPBACK_HOST = '127.0.0.1'
const API_PATHS = new Set(['/config', '/dead', '/compare', '/events'])

const tokensEqual = (actual: string, expected: string): boolean => {
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export const hasDashboardAccess = (request: Pick<IncomingMessage, 'headers'>, url: URL, token: string): boolean => {
  const header = request.headers['x-artie-token']
  const supplied = (Array.isArray(header) ? header[0] : header) ?? url.searchParams.get('token') ?? ''
  return tokensEqual(supplied, token)
}

export const shouldRefreshDashboard = (path: string, directory: string, options: RunOptions): boolean => {
  const name = basename(path)
  if (/\.tsx?$/.test(name) || name === '.artierc.json' || name === 'tsconfig.json') return true
  const watchedFiles = [options.coverage ?? DEFAULT_COVERAGE, options.record ?? DEFAULT_HISTORY]
    .map((file) => resolve(directory, file))
  return watchedFiles.includes(resolve(path))
}

const readBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = ''
    let bytes = 0
    let exceeded = false
    request.on('data', (chunk) => {
      if (exceeded) return
      bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      if (bytes > MAX_BODY_BYTES) {
        exceeded = true
        request.removeAllListeners('data')
        request.resume()
        reject(new Error('Config payload too large.'))
        return
      }
      body += chunk
    })
    request.on('end', () => { if (!exceeded) resolve(body) })
    request.on('error', reject)
  })

export const dashboardLens = async (directory = process.cwd(), options: RunOptions = {}): Promise<void> => {
  const port = Number(options.port) || DEFAULT_PORT
  const accessToken = randomBytes(24).toString('hex')
  const clients: ServerResponse[] = []
  let html = ''

  const render = async (): Promise<void> => {
    const collected = await collectReport(directory)
    const data = assembleDashboardData(directory, options, collected, true)

    html = buildDashboard(data, accessToken)
    const payload = JSON.stringify(buildDashboardModel(data))
    for (const client of clients) client.write(`data: ${payload}\n\n`)
  }
  const renders = createLatestRunQueue(render)

  // Dead-code detection is expensive, so it is computed on demand (when the client opens the tab)
  // rather than on every re-analysis.
  const deadCode = async (): Promise<string> => {
    const config = readConfig()
    const context = await buildAnalysisContext(directory, config.includes!, config.excludes!, config.options.ignoreReExports)
    const dead = context ? findDeadExports(context, config.options.deadCode?.entries ?? []) : []
    return JSON.stringify({ deadCode: dead })
  }

  // Analyzes a ref in a throwaway worktree and diffs it against the working tree. Computed on
  // demand from the Compare tab because it doubles the analysis work.
  const compare = async (ref: string): Promise<string> => {
    if (ref.startsWith('-')) throw new Error('Invalid ref.')
    const base = await analyzeRef(directory, ref)
    if (!base) throw new Error(`Could not analyze "${ref}".`)
    const head = (await collectReport(directory)).report
    return JSON.stringify(compareReports(base, head, ref))
  }

  // Persists the edited config, re-analyzes, and streams the new model to every client. If the new
  // config cannot be analyzed, the previous file is restored so a bad edit never breaks the server.
  const applyConfig = async (request: IncomingMessage): Promise<void> => {
    const parsed = assertConfigShape(JSON.parse(await readBody(request)))
    const configPath = getConfigPath()
    const previous = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : null

    writeConfig(parsed)
    try {
      await renders.run()
    } catch (error) {
      if (previous !== null) writeFileSync(configPath, previous)
      throw error
    }
  }

  await renders.run()

  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Cache-Control', 'no-store')

    const url = new URL(request.url ?? '/', `http://${LOOPBACK_HOST}`)
    const isApi = API_PATHS.has(url.pathname)
    if (isApi && !hasDashboardAccess(request, url, accessToken)) {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Unauthorized dashboard request.' }))
      return
    }

    if (request.method === 'POST' && url.pathname === '/config') {
      try {
        await applyConfig(request)
        response.writeHead(204).end()
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/dead') {
      try {
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(await deadCode())
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/compare') {
      try {
        const ref = url.searchParams.get('ref') || 'main'
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(await compare(ref))
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
      response.write('\n')
      clients.push(response)
      request.on('close', () => {
        const index = clients.indexOf(response)
        if (index >= 0) clients.splice(index, 1)
      })
      return
    }

    if (isApi) {
      response.writeHead(405, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Method not allowed.' }))
      return
    }

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(html)
  })

  server.listen(port, LOOPBACK_HOST, () => console.log(`🔍 artie-lens dashboard on http://${LOOPBACK_HOST}:${port}  (watching for changes, Ctrl+C to stop)`))

  let timer: ReturnType<typeof setTimeout> | undefined
  const watcher = watch(directory, {
    ignored: (path) => path.includes('node_modules') || path.includes('/.git/'),
    ignoreInitial: true,
  })

  watcher.on('all', (_event, path) => {
    if (!shouldRefreshDashboard(path, directory, options)) return
    clearTimeout(timer)
    timer = setTimeout(() => renders.run().catch((error) => console.error(error)), WATCH_DEBOUNCE_MS)
  })
}

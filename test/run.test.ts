import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runLens } from '../src/routines/run.routine'
import { cleanupProjects, createProject } from './utils'

const artierc = JSON.stringify({
  options: {
    defaultThresholds: { warning: 2, critical: 3, levels: ['OK', 'WARNING', 'CRITICAL'] },
    metrics: { wmc: { enabled: true, warning: 2, critical: 3 } },
  },
  includes: ['**/*.ts'],
  excludes: [],
})

const critical = `export class Big {
  a(): number { return 1 }
  b(): number { return 2 }
  c(): number { return 3 }
}`

const ok = `export class Small { a(): number { return 1 } }`

let originalCwd: string
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  originalCwd = process.cwd()
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'time').mockImplementation(() => undefined)
  vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined)
})

afterEach(() => {
  process.chdir(originalCwd)
  vi.restoreAllMocks()
  cleanupProjects()
})

describe('runLens', () => {
  it('flags failed when a class reaches the fail level', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'big.ts': critical, 'small.ts': ok })
    process.chdir(directory)

    const report = await runLens(directory, { failOn: 'CRITICAL' })

    expect(report.failed).toBeTruthy()
    expect(report.metrics[0].metric).toBe('wmc')
  })

  it('does not fail when no class reaches the fail level', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'small.ts': ok })
    process.chdir(directory)

    const report = await runLens(directory, { failOn: 'CRITICAL' })

    expect(report.failed).toBe(false)
  })

  it('never fails when --fail-on is not provided', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'big.ts': critical })
    process.chdir(directory)

    const report = await runLens(directory)

    expect(report.failed).toBe(false)
  })

  it('emits parseable JSON carrying the report and failed flag', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'big.ts': critical, 'small.ts': ok })
    process.chdir(directory)

    const report = await runLens(directory, { json: true, failOn: 'WARNING' })

    const output = logSpy.mock.calls.map(([ call ]) => call).join('\n')
    const parsed = JSON.parse(output)

    expect(report.failed).toBe(true)
    expect(parsed.failed).toBe(true)
    expect(parsed.metrics[0].classes).toHaveLength(2)
  })
})

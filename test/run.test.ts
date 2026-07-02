import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
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

    expect(report.failed).toBeFalsy()
  })

  it('never fails when --fail-on is not provided', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'big.ts': critical })
    process.chdir(directory)

    const report = await runLens(directory)

    expect(report.failed).toBeFalsy()
  })

  it('emits parseable JSON carrying the report and failed flag', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'big.ts': critical, 'small.ts': ok })
    process.chdir(directory)

    const report = await runLens(directory, { json: true, failOn: 'WARNING' })

    const output = logSpy.mock.calls.map(([ call ]) => call).join('\n')
    const parsed = JSON.parse(output)

    expect(report.failed).toBeTruthy()
    expect(parsed.failed).toBeTruthy()
    expect(parsed.metrics[0].classes).toHaveLength(2)
  })
})

describe('runLens baseline', () => {
  it('saves a baseline file without failing', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'big.ts': critical })
    process.chdir(directory)
    const baselinePath = join(directory, 'baseline.json')

    const report = await runLens(directory, { saveBaseline: baselinePath })

    expect(report.failed).toBeFalsy()
    expect(existsSync(baselinePath)).toBeTruthy()
  })

  it('flags a regression against a healthier baseline', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'big.ts': critical })
    process.chdir(directory)
    const baselinePath = join(directory, 'baseline.json')
    const summary = { total: 0, max: 0, min: 0, average: '0', deviation: '0' }
    writeFileSync(baselinePath, JSON.stringify({
      metrics: [{ metric: 'wmc', summary, classes: [{ value: 'Big', total: 1, label: 'OK' }] }],
    }))

    const report = await runLens(directory, { baseline: baselinePath, failOn: 'WARNING' })

    expect(report.failed).toBeTruthy()
    expect(report.regressions?.some((item) => item.value === 'Big')).toBeTruthy()
  })

  it('reports no regressions when the baseline matches the current run', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'big.ts': critical })
    process.chdir(directory)
    const baselinePath = join(directory, 'baseline.json')

    await runLens(directory, { saveBaseline: baselinePath })
    const report = await runLens(directory, { baseline: baselinePath, failOn: 'WARNING' })

    expect(report.failed).toBeFalsy()
    expect(report.regressions).toHaveLength(0)
  })

  it('does not fail when the baseline file is missing', async () => {
    const directory = createProject({ '.artierc.json': artierc, 'big.ts': critical })
    process.chdir(directory)

    const report = await runLens(directory, { baseline: join(directory, 'nope.json'), failOn: 'WARNING' })

    expect(report.failed).toBeFalsy()
  })
})

import { execFileSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'

import { computeHotspots } from '../src/helpers/hotspot.helpers'
import { getChurn } from '../src/helpers/git.helpers'
import { MetricReport, MetricResult } from '../src/types/config.interface'
import { cleanupProjects, createProject } from './utils'

const summary = { total: 0, max: 0, min: 0, average: '0', deviation: '0' }

const item = (value: string, total: number, label: string, file: string): MetricResult => ({ value, total, label, file })

const report = (metric: string, classes: MetricResult[]): MetricReport => ({ metric, summary, classes })

afterEach(() => cleanupProjects())

describe('computeHotspots', () => {
  it('ranks by structural badness multiplied by churn', () => {
    const metrics = [
      report('wmc', [
        item('Churned', 30, 'CRITICAL', 'churned.ts'),
        item('Stale', 30, 'CRITICAL', 'stale.ts'),
      ]),
    ]
    const churn = new Map([['churned.ts', 10], ['stale.ts', 1]])

    const hotspots = computeHotspots(metrics, churn)

    expect(hotspots).toHaveLength(2)
    expect(hotspots[0].file).toBe('churned.ts')
    expect(hotspots[0].score).toBe(30)
    expect(hotspots[1].file).toBe('stale.ts')
    expect(hotspots[1].score).toBe(3)
  })

  it('ignores healthy files no matter how often they change', () => {
    const metrics = [report('wmc', [item('Clean', 1, 'OK', 'clean.ts')])]
    const churn = new Map([['clean.ts', 50]])

    expect(computeHotspots(metrics, churn)).toHaveLength(0)
  })

  it('ignores unhealthy files that are not being touched', () => {
    const metrics = [report('wmc', [item('Frozen', 30, 'CRITICAL', 'frozen.ts')])]

    expect(computeHotspots(metrics, new Map())).toHaveLength(0)
  })

  it('accumulates badness across metrics for the same file', () => {
    const metrics = [
      report('wmc', [item('Svc', 30, 'CRITICAL', 'svc.ts')]),
      report('cbo', [item('Svc', 9, 'WARNING', 'svc.ts')]),
    ]
    const churn = new Map([['svc.ts', 2]])

    const [hotspot] = computeHotspots(metrics, churn)

    expect(hotspot.badness).toBe(4)
    expect(hotspot.score).toBe(8)
    expect(hotspot.findings).toHaveLength(2)
  })
})

describe('getChurn', () => {
  it('counts how many commits touched each file', () => {
    const directory = createProject({ 'a.ts': 'export const a = 1', 'b.ts': 'export const b = 1' })
    const git = (...args: string[]) => execFileSync('git', ['-C', directory, ...args], { stdio: 'ignore' })

    git('init')
    git('config', 'user.email', 'test@test.com')
    git('config', 'user.name', 'test')
    git('add', '-A')
    git('commit', '-m', 'init')

    execFileSync('bash', ['-c', `echo "export const a2 = 2" >> ${directory}/a.ts`])
    git('commit', '-am', 'change a')

    const churn = getChurn(directory, '10 years ago')

    expect(churn?.get('a.ts')).toBe(2)
    expect(churn?.get('b.ts')).toBe(1)
  })

  it('returns null outside a git repository', () => {
    const directory = createProject({ 'a.ts': 'export const a = 1' })

    expect(getChurn(directory, '10 years ago')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'

import { buildDashboard, DashboardData } from '../src/helpers/report.dashboard'
import { Hotspot, MetricReport, RuleViolation } from '../src/types/config.interface'

const summary = { total: 0, max: 0, min: 0, average: '0', deviation: '0' }

const report: MetricReport[] = [
  {
    metric: 'wmc',
    summary,
    classes: [
      { value: 'OrderService', total: 30, label: 'CRITICAL', file: 'src/order.ts' },
      { value: 'PayService', total: 12, label: 'WARNING', file: 'src/pay.ts' },
      { value: 'Ok', total: 2, label: 'OK', file: 'src/ok.ts' },
    ],
  },
  { metric: 'cbo', summary, classes: [{ value: 'OrderService', total: 9, label: 'WARNING', file: 'src/order.ts' }] },
]
const violations: RuleViolation[] = [{ from: 'src/domain/a.ts', to: 'src/infra/b.ts', message: 'no' }]
const hotspots: Hotspot[] = [
  { file: 'src/order.ts', churn: 10, badness: 3, score: 30, findings: ['WMC CRITICAL OrderService (30)'] },
  { file: 'src/pay.ts', churn: 4, badness: 1, score: 4, findings: ['WMC WARNING PayService (12)'] },
  { file: 'src/misc.ts', churn: 2, badness: 1, score: 2, findings: ['CBO WARNING Misc (9)'] },
]
const cycles = [{ size: 3, path: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts'] }]
const config = {
  options: { defaultThresholds: { warning: 5, critical: 10, levels: ['WARNING', 'CRITICAL'] }, metrics: { wmc: { enabled: true, warning: 4, critical: 8 }, cbo: { enabled: true } } },
  includes: ['**/*.ts'],
  excludes: ['node_modules'],
}

const boot = (overrides: Partial<DashboardData> = {}): JSDOM => {
  const html = buildDashboard({ report, violations, hotspots, cycles, config, generatedAt: '2026-01-01T00:00:00Z', live: false, ...overrides })
  return new JSDOM(html, { runScripts: 'dangerously', url: 'https://artie.test/' })
}

describe('dashboard client app', () => {
  it('renders header, six tabs and KPIs from the embedded model', () => {
    const doc = boot().window.document

    expect(doc.querySelectorAll('.tab')).toHaveLength(7)
    expect(doc.querySelector('.pill')!.textContent).toContain('fail') // a CRITICAL and a violation
    expect(doc.querySelector('.kpi .val')!.textContent).toBe('1') // criticals KPI is first
    expect(doc.body.textContent).toContain('OrderService')
  })

  it('lays out the hotspot treemap as positioned cells', () => {
    const cells = boot().window.document.querySelectorAll('.tree .cell')

    expect(cells).toHaveLength(3)
    expect((cells[0] as HTMLElement).style.width).toMatch(/%$/)
    expect((cells[0] as HTMLElement).style.height).toMatch(/%$/)
  })

  it('switches the active tab on click', () => {
    const doc = boot().window.document
    const metrics = [...doc.querySelectorAll('.tab')].find((tab) => /Metrics/.test(tab.textContent ?? ''))!

    ;(metrics as HTMLElement).click()

    expect(doc.querySelector('.tab.on')!.textContent).toContain('Metrics')
    expect(doc.querySelector('.chips')).toBeTruthy()
  })

  it('opens the drill-down drawer with the file metric profile', () => {
    const doc = boot().window.document
    const row = doc.querySelector('tr[data-file="src/order.ts"]') as HTMLElement

    row.click()

    const drawer = doc.getElementById('drawer')!
    expect(drawer.classList.contains('on')).toBe(true)
    expect(doc.getElementById('dwBody')!.textContent).toContain('WMC')
  })

  it('translates the interface when the language changes', () => {
    const dom = boot()
    const doc = dom.window.document
    const select = doc.querySelector('[data-lang]') as HTMLSelectElement

    select.value = 'pt'
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

    expect([...doc.querySelectorAll('.tab')].map((tab) => tab.textContent).join(' ')).toContain('Visão geral')
    expect(doc.documentElement.getAttribute('lang')).toBe('pt')
  })

  it('mirrors the layout for a right-to-left language', () => {
    const dom = boot()
    const doc = dom.window.document
    const select = doc.querySelector('[data-lang]') as HTMLSelectElement

    select.value = 'ar'
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

    expect(doc.documentElement.getAttribute('dir')).toBe('rtl')
  })

  it('toggles the theme and persists the choice', () => {
    const dom = boot()
    const doc = dom.window.document
    const before = doc.documentElement.getAttribute('data-theme')

    ;(doc.querySelector('[data-theme-toggle]') as HTMLElement).click()

    const after = doc.documentElement.getAttribute('data-theme')
    expect(after).not.toBe(before)
    expect(dom.window.localStorage.getItem('artie-theme')).toBe(after)
  })

  it('omits the live channel when not live', () => {
    expect(boot({ live: false }).window.document.documentElement.outerHTML).not.toContain('EventSource')
  })

  it('draws each dependency cycle as a node-link graph', () => {
    const doc = boot().window.document
    const violationsTab = [...doc.querySelectorAll('.tab')].find((tab) => /Violations/.test(tab.textContent ?? ''))!

    ;(violationsTab as HTMLElement).click()

    const graph = doc.querySelector('.cyc svg')!
    expect(graph).toBeTruthy()
    // three unique files in the cycle become three clickable nodes
    expect(graph.querySelectorAll('g[data-file]')).toHaveLength(3)
    expect(graph.querySelectorAll('path[marker-end]').length).toBeGreaterThanOrEqual(3)
  })

  it('renders the config form from the embedded config', () => {
    const doc = boot().window.document
    ;(doc.querySelector('[data-tab="config"]') as HTMLElement).click()

    expect(doc.querySelectorAll('tr[data-cfg-metric]')).toHaveLength(2) // wmc, cbo
    expect((doc.querySelector('[data-cfg="includes"]') as HTMLTextAreaElement).value).toBe('**/*.ts')
    expect(doc.querySelector('[data-process]')).toBeNull() // no Process button when not live
    expect(doc.body.textContent).toContain('artie dashboard') // the live-only note
  })

  it('shows the skeleton and posts the edited config when processing (live)', async () => {
    const dom = boot({ live: true })
    const doc = dom.window.document
    let posted: any = null
    ;(dom.window as any).fetch = (url: string, init: any) => { posted = { url, init }; return Promise.resolve({ ok: true, status: 204 }) }

    ;(doc.querySelector('[data-tab="config"]') as HTMLElement).click()
    ;(doc.querySelector('tr[data-cfg-metric="wmc"] [data-k="warning"]') as HTMLInputElement).value = '3'
    ;(doc.querySelector('[data-process]') as HTMLElement).click()

    expect(doc.querySelector('.sk')).toBeTruthy() // skeleton is shown while analyzing
    expect(posted.url).toBe('/config')
    expect(posted.init.method).toBe('POST')
    const sent = JSON.parse(posted.init.body)
    expect(sent.options.metrics.wmc.warning).toBe(3) // the edited value was collected
  })
})

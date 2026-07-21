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

const boot = (overrides: Partial<DashboardData> = {}): JSDOM => {
  const html = buildDashboard({ report, violations, hotspots, generatedAt: '2026-01-01T00:00:00Z', live: false, ...overrides })
  return new JSDOM(html, { runScripts: 'dangerously', url: 'https://artie.test/' })
}

describe('dashboard client app', () => {
  it('renders header, six tabs and KPIs from the embedded model', () => {
    const doc = boot().window.document

    expect(doc.querySelectorAll('.tab')).toHaveLength(6)
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
})

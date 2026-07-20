import { Hotspot, RuleViolation } from '../types/config.interface'

export interface DashboardView {
  generatedAt: string
  live: boolean
  failed: boolean
  kpis: { criticals: number; warnings: number; violations: number; hotspots: number; metrics: number }
  bars: { metric: string; warning: number; critical: number }[]
  offenders: { label: string; metric: string; value: string; total: number }[]
  hotspots: Hotspot[]
  violations: RuleViolation[]
}

const HOTSPOT_ROWS = 10

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const STYLE = `
  :root{--bg:#f6f8fa;--card:#fff;--fg:#1f2328;--muted:#57606a;--line:#e6e8eb;--accent:#0969da;--warn:#bf8700;--crit:#cf222e;--ok:#1a7f37}
  @media(prefers-color-scheme:dark){:root{--bg:#0d1117;--card:#161b22;--fg:#e6edf3;--muted:#8b949e;--line:#30363d;--accent:#58a6ff;--warn:#d29922;--crit:#f85149;--ok:#3fb950}}
  *{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;background:var(--bg);color:var(--fg)}
  .wrap{max-width:1000px;margin:0 auto;padding:2rem 1.25rem}
  header{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}h1{font-size:1.4rem;margin:0}
  .status{font-size:.75rem;font-weight:600;padding:.2rem .6rem;border-radius:999px}
  .status.pass{background:color-mix(in srgb,var(--ok) 18%,transparent);color:var(--ok)}
  .status.fail{background:color-mix(in srgb,var(--crit) 18%,transparent);color:var(--crit)}
  .at{color:var(--muted);font-size:.8rem;margin-left:auto}
  .live{display:inline-flex;align-items:center;gap:.35rem;color:var(--ok);font-size:.75rem}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--ok);animation:pulse 1.6s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin:1.5rem 0}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:.2rem}
  .kpi-value{font-size:1.9rem;font-weight:700;font-variant-numeric:tabular-nums}
  .kpi-label{font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
  .kpi.crit .kpi-value{color:var(--crit)}.kpi.warn .kpi-value{color:var(--warn)}.kpi.accent .kpi-value{color:var(--accent)}
  section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1.25rem 1.5rem;margin:1rem 0}
  h2{font-size:1.05rem;margin:0 0 1rem}
  .bars{display:flex;flex-direction:column;gap:.6rem}
  .bar-row{display:grid;grid-template-columns:90px 1fr auto;align-items:center;gap:.75rem;font-size:.85rem}
  .bar-label{font-weight:600;font-size:.78rem}.bar{display:flex;height:14px;background:var(--bg);border-radius:6px;overflow:hidden}
  .seg{height:100%}.seg.critical{background:var(--crit)}.seg.warning{background:var(--warn)}
  .bar-count{color:var(--muted);font-size:.78rem;white-space:nowrap}
  table{width:100%;border-collapse:collapse;font-size:.88rem}th{text-align:left;color:var(--muted);font-weight:600;font-size:.75rem;padding:.3rem .5rem}
  td{padding:.45rem .5rem;border-top:1px solid var(--line)}.num{text-align:right;font-variant-numeric:tabular-nums}.mono{font-family:ui-monospace,monospace;color:var(--muted);font-size:.8rem}
  .badge{font-size:.7rem;font-weight:600;padding:.1rem .45rem;border-radius:999px}
  .badge.warning{background:color-mix(in srgb,var(--warn) 20%,transparent);color:var(--warn)}
  .badge.critical{background:color-mix(in srgb,var(--crit) 20%,transparent);color:var(--crit)}
  .violations{margin:0;padding-left:1.1rem;line-height:1.9}code{font-family:ui-monospace,monospace;font-size:.82rem}
  .summary,.clean{color:var(--muted);font-size:.85rem}.clean{margin:0}
  footer{color:var(--muted);font-size:.78rem;text-align:center;margin-top:1.5rem}
`

const LIVE_SCRIPT = '<script>const s=new EventSource("/events");s.onmessage=()=>location.reload();</script>'

const headerSection = (view: DashboardView): string =>
  `<header><h1>🔍 artie-lens</h1>` +
  `<span class="status ${view.failed ? 'fail' : 'pass'}">${view.failed ? 'needs attention' : 'healthy'}</span>` +
  (view.live ? '<span class="live"><span class="dot"></span>live</span>' : '') +
  `<span class="at">${escape(view.generatedAt)}</span></header>`

const kpiCard = (label: string, value: number, tone: string): string =>
  `<div class="kpi ${tone}"><span class="kpi-value">${value}</span><span class="kpi-label">${label}</span></div>`

const kpiSection = (kpis: DashboardView['kpis']): string =>
  `<div class="kpis">` +
  kpiCard('criticals', kpis.criticals, 'crit') +
  kpiCard('warnings', kpis.warnings, 'warn') +
  kpiCard('violations', kpis.violations, kpis.violations ? 'crit' : '') +
  kpiCard('hotspots', kpis.hotspots, 'accent') +
  kpiCard('metrics', kpis.metrics, '') +
  `</div>`

const barsSection = (bars: DashboardView['bars']): string => {
  const active = bars.filter((item) => item.warning + item.critical > 0).sort((a, b) => b.warning + b.critical - (a.warning + a.critical))
  if (!active.length) return '<section><h2>Issues by metric</h2><p class="clean">✅ No warnings or criticals across any metric.</p></section>'

  const max = Math.max(...active.map((item) => item.warning + item.critical))
  const rows = active
    .map((item) => {
      const criticalWidth = (item.critical / max) * 100
      const warningWidth = (item.warning / max) * 100
      return `<div class="bar-row"><span class="bar-label">${item.metric.toUpperCase()}</span>` +
        `<span class="bar"><span class="seg critical" style="width:${criticalWidth}%"></span><span class="seg warning" style="width:${warningWidth}%"></span></span>` +
        `<span class="bar-count">${item.critical} critical · ${item.warning} warning</span></div>`
    })
    .join('')

  return `<section><h2>Issues by metric</h2><div class="bars">${rows}</div></section>`
}

const offendersSection = (offenders: DashboardView['offenders']): string => {
  if (!offenders.length) return ''

  const rows = offenders
    .map((item) => `<tr><td><span class="badge ${item.label.toLowerCase()}">${item.label}</span></td><td class="mono">${item.metric.toUpperCase()}</td><td>${escape(item.value)}</td><td class="num">${item.total}</td></tr>`)
    .join('')

  return `<section><h2>Worst offenders</h2><table><thead><tr><th></th><th>metric</th><th>class / module</th><th class="num">value</th></tr></thead><tbody>${rows}</tbody></table></section>`
}

const hotspotsSection = (hotspots: Hotspot[]): string => {
  if (!hotspots.length) return ''

  const rows = hotspots
    .slice(0, HOTSPOT_ROWS)
    .map((item) => `<tr><td class="num">${item.score}</td><td>${escape(item.file)}</td><td class="mono">${item.churn} changes</td><td>${item.findings.map(escape).join('<br>')}</td></tr>`)
    .join('')

  return `<section><h2>🔥 Hotspots</h2><p class="summary">Complexity crossed with git churn. Where to start.</p><table><thead><tr><th class="num">score</th><th>file</th><th>churn</th><th>findings</th></tr></thead><tbody>${rows}</tbody></table></section>`
}

const violationsSection = (violations: RuleViolation[]): string => {
  if (!violations.length) return ''

  const rows = violations
    .map((item) => `<li><code>${escape(item.from)}</code> &rarr; <code>${escape(item.to)}</code> <span class="summary">${escape(item.message)}</span></li>`)
    .join('')

  return `<section><h2>✖ Architecture violations</h2><ul class="violations">${rows}</ul></section>`
}

export const renderDashboard = (view: DashboardView): string => {
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>artie-lens dashboard</title><style>${STYLE}</style></head><body><div class="wrap">`
  const sections = [
    headerSection(view),
    kpiSection(view.kpis),
    barsSection(view.bars),
    violationsSection(view.violations),
    offendersSection(view.offenders),
    hotspotsSection(view.hotspots),
  ].join('')
  const footer = `<footer>Generated by artie-lens</footer></div>${view.live ? LIVE_SCRIPT : ''}</body></html>`

  return head + sections + footer
}

export interface Thresholds {
  warning?: number
  critical?: number
  levels?: string[]
}

export interface MetricConfig extends Thresholds {
  enabled?: boolean
}

export interface MetricResult {
  total: number
  label: string
  value: string
  file?: string
}

export interface Hotspot {
  file: string
  churn: number
  badness: number
  score: number
  findings: string[]
}

export interface Seam {
  modules: string[]
  internal: number
  crossing: number
}

export interface MetricInsights {
  total: number
  max: number
  min: number
  average: string
  deviation: string
}

export interface ArchitectureRule {
  from: string | string[]
  cannotImport?: string | string[]
  canOnlyImport?: string | string[]
  message?: string
}

export interface RuleViolation {
  from: string
  to: string
  message: string
}

export interface ArtieConfig {
  includes?: string[]
  excludes?: string[]
  rules?: ArchitectureRule[]
  options: {
    defaultThresholds: Thresholds
    metrics: Record<string, MetricConfig>
    ignoreReExports?: boolean
  }
}

export interface RunOptions {
  json?: boolean
  failOn?: string
  baseline?: string
  saveBaseline?: string
  watch?: boolean
  suggest?: boolean
  hotspots?: boolean
  since?: string
  sarif?: string
  html?: string
}

export interface MetricReport {
  metric: string
  summary: MetricInsights
  classes: MetricResult[]
}

export interface Regression {
  metric: string
  value: string
  from: string
  to: string
  fromTotal: number
  toTotal: number
}

export interface RunReport {
  metrics: MetricReport[]
  regressions?: Regression[]
  violations?: RuleViolation[]
  failed: boolean
}
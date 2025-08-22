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
}

export interface ArtieConfig {
  includes?: string[]
  excludes?: string[]
  options: {
    defaultThresholds: Thresholds
    metrics: Record<string, MetricConfig>
  }
}
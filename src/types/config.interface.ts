export interface Thresholds {
  warning?: number
  critical?: number
}

export interface MetricConfig extends Thresholds {
  enabled?: boolean
}

export interface ArtieConfig {
  include?: string[]
  exclude?: string[]
  options: {
    defaultThresholds: Thresholds
    metrics: Record<string, MetricConfig>
  }
}
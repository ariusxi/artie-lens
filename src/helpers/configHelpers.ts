import path from 'path'

import { readFileContent } from './fileHelpers'
import { ArtieConfig, MetricConfig, MetricInsights, MetricResult } from '../types/config.interface'

export function readConfig(): ArtieConfig {
  const filePath = path.resolve(process.cwd(), '.artierc.json')
  const config = readFileContent(filePath)

  return JSON.parse(config)
}

export function getEnableMetrics(config: ArtieConfig): string[] {
  const enabled = []

  for (const metric of Object.keys(config.options.metrics)) {
    const currentMetric = config.options.metrics[metric]
    if (currentMetric.enabled) {
      enabled.push(metric)
    }
  }

  return enabled
}

export function getMetricConfig(metricName: string): MetricConfig {
  const config = readConfig()

  const defaults = config.options.defaultThresholds
  const metric = config.options.metrics[metricName.toLowerCase()]

  if (!metric) {
    throw new Error(`Metric ${metricName} not found.`)
  }

  if (!metric.enabled) {
    return { enabled: false }
  }

  return {
    enabled: metric.enabled,
    warning: metric.warning ?? defaults.warning,
    critical: metric.critical ?? defaults.critical,
    levels: metric.levels ?? defaults.levels,
  }
}

export function getMetricIndexes(result: MetricResult[]): MetricInsights {
  if (result.length === 0) {
    return {
      total: 0,
      max: 0,
      min: 0,
      average: '0',
      deviation: '0',
    }
  }

  const values = result.map((r) => r.total)
  const total = values.reduce((a, b) => a + b, 0)

  const average = total / values.length
  const max = Math.max(...values)
  const min = Math.min(...values)

  const variance = values.reduce((acc, v) => acc + Math.pow(v - average, 2), 0) / values.length
  const deviation = Math.sqrt(variance)

  return {
    total,
    max,
    min,
    average: average.toFixed(2),
    deviation: deviation.toFixed(2),
  }
}
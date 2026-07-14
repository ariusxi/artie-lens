import path from 'path'

import { ArtieConfig, MetricConfig, MetricInsights, MetricResult, RunOptions } from '../types/config.interface'

import { readFileContent } from './file.helpers'
import { DEFAULT_BASELINE } from './baseline.helpers'

export const readConfig = (): ArtieConfig => {
  const filePath = path.resolve(process.cwd(), '.artierc.json')
  const config = readFileContent(filePath)

  return JSON.parse(config)
}

const flagValue = (flag: string, fallback: string): string => {
  const value = flag.split('=').slice(1).join('=')
  return value || fallback
}

export const parseRunOptions = (flags: string[]): RunOptions => {
  const options: RunOptions = {}

  for (const flag of flags) {
    if (flag === '--json') { options.json = true; continue }
    if (flag === '--watch') { options.watch = true; continue }
    if (flag === '--suggest') { options.suggest = true; continue }
    if (flag === '--hotspots') { options.hotspots = true; continue }
    if (flag.startsWith('--since=')) { options.since = flag.split('=').slice(1).join('='); continue }
    if (flag.startsWith('--fail-on=')) { options.failOn = flag.split('=')[1]?.toUpperCase(); continue }
    if (flag === '--save-baseline' || flag.startsWith('--save-baseline=')) { options.saveBaseline = flagValue(flag, DEFAULT_BASELINE); continue }
    if (flag === '--baseline' || flag.startsWith('--baseline=')) { options.baseline = flagValue(flag, DEFAULT_BASELINE) }
  }

  return options
}

export const getEnableMetrics = (config: ArtieConfig): string[] =>
  Object.keys(config.options.metrics).filter((metric) => config.options.metrics[metric].enabled)

export const resolveMetricConfig = (config: ArtieConfig, metricName: string): MetricConfig => {
  const defaults = config.options.defaultThresholds
  const metric = config.options.metrics[metricName.toLowerCase()]

  if (!metric) throw new Error(`Metric ${metricName} not found.`)
  if (!metric.enabled) return { enabled: false }

  return {
    enabled: metric.enabled,
    warning: metric.warning ?? defaults.warning,
    critical: metric.critical ?? defaults.critical,
    levels: metric.levels ?? defaults.levels,
  }
}

export const getMetricConfig = (metricName: string): MetricConfig => resolveMetricConfig(readConfig(), metricName)

const EMPTY_INDEXES: MetricInsights = { total: 0, max: 0, min: 0, average: '0', deviation: '0' }

export const getMetricIndexes = (result: MetricResult[]): MetricInsights => {
  if (result.length === 0) return EMPTY_INDEXES

  const values = result.map((item) => item.total)
  const total = values.reduce((sum, value) => sum + value, 0)
  const average = total / values.length
  const max = Math.max(...values)
  const min = Math.min(...values)

  const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length
  const deviation = Math.sqrt(variance)

  return {
    total,
    max,
    min,
    average: average.toFixed(2),
    deviation: deviation.toFixed(2),
  }
}

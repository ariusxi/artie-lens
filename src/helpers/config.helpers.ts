import path from 'path'
import { existsSync } from 'fs'

import { ArtieConfig, MetricConfig, MetricInsights, MetricResult, RunOptions } from '../types/config.interface'

import { readFileContent } from './file.helpers'
import { DEFAULT_BASELINE } from './baseline.helpers'
import { DEFAULT_HISTORY } from './trend.helpers'

export const readConfig = (): ArtieConfig => {
  const filePath = path.resolve(process.cwd(), '.artierc.json')
  if (!existsSync(filePath)) throw new Error('No .artierc.json found in this directory. Run `artie init` first.')

  const content = readFileContent(filePath)
  try {
    return JSON.parse(content)
  } catch {
    throw new Error('.artierc.json is not valid JSON.')
  }
}

const BOOLEAN_FLAGS: Record<string, (options: RunOptions) => void> = {
  '--json': (options) => { options.json = true },
  '--watch': (options) => { options.watch = true },
  '--suggest': (options) => { options.suggest = true },
  '--hotspots': (options) => { options.hotspots = true },
}

interface ValueFlag {
  set: (options: RunOptions, value: string) => void
  default?: string
}

const VALUE_FLAGS: Record<string, ValueFlag> = {
  '--since': { set: (options, value) => { options.since = value } },
  '--fail-on': { set: (options, value) => { options.failOn = value.toUpperCase() } },
  '--save-baseline': { set: (options, value) => { options.saveBaseline = value }, default: DEFAULT_BASELINE },
  '--baseline': { set: (options, value) => { options.baseline = value }, default: DEFAULT_BASELINE },
  '--sarif': { set: (options, value) => { options.sarif = value }, default: 'artie-lens.sarif' },
  '--html': { set: (options, value) => { options.html = value }, default: 'artie-lens.html' },
  '--record': { set: (options, value) => { options.record = value }, default: DEFAULT_HISTORY },
  '--port': { set: (options, value) => { options.port = value } },
}

export const parseRunOptions = (flags: string[]): RunOptions => {
  const options: RunOptions = {}

  for (const flag of flags) {
    const [name, ...rest] = flag.split('=')

    const booleanFlag = BOOLEAN_FLAGS[name]
    if (booleanFlag) {
      booleanFlag(options)
      continue
    }

    const valueFlag = VALUE_FLAGS[name]
    if (!valueFlag) continue

    const value = rest.join('=') || valueFlag.default
    if (value !== undefined) valueFlag.set(options, value)
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

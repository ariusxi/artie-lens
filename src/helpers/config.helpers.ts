import path from 'path'
import { existsSync, writeFileSync } from 'fs'

import { ArtieConfig, MetricConfig, MetricInsights, MetricResult, RunOptions, Thresholds } from '../types/config.interface'

import { readFileContent } from './file.helpers'
import { DEFAULT_BASELINE } from './baseline.helpers'
import { DEFAULT_HISTORY } from './trend.helpers'
import { DEFAULT_COVERAGE } from './coverage.helpers'

export const getConfigPath = (): string => path.resolve(process.cwd(), '.artierc.json')

export const readConfig = (): ArtieConfig => {
  const filePath = getConfigPath()
  if (!existsSync(filePath)) throw new Error('No .artierc.json found in this directory. Run `artie init` first.')

  const content = readFileContent(filePath)
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('.artierc.json is not valid JSON.')
  }
  return assertConfigShape(parsed)
}

const METRICS = new Set(['lcom', 'wmc', 'cognitive', 'rfc', 'cbo', 'dit', 'noc', 'ce', 'cyclic', 'distance'])
const LEVELS = new Set(['OK', 'WARNING', 'CRITICAL'])
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const asStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`"${field}" must be an array of strings.`)
  return value
}
const assertGlob = (value: unknown, field: string): void => {
  if (typeof value === 'string') return
  asStringArray(value, field)
}
const assertThreshold = (value: unknown, field: string): void => {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error(`"${field}" must be a non-negative number.`)
  }
}

const asThresholds = (value: unknown, field: string): Thresholds => {
  if (!isRecord(value)) throw new Error(`"${field}" must be an object.`)
  assertThreshold(value.warning, `${field}.warning`)
  assertThreshold(value.critical, `${field}.critical`)
  if (value.levels !== undefined) {
    const levels = asStringArray(value.levels, `${field}.levels`)
    if (levels.length === 0 || levels.some((level) => !LEVELS.has(level))) {
      throw new Error(`"${field}.levels" must contain only OK, WARNING, or CRITICAL.`)
    }
  }
  return value as Thresholds
}

export const assertConfigShape = (config: unknown): ArtieConfig => {
  if (!isRecord(config)) throw new Error('Config must be an object.')
  if (!isRecord(config.options)) throw new Error('Config is missing "options".')
  const options = config.options
  const defaults = asThresholds(options.defaultThresholds, 'options.defaultThresholds')
  if (!isRecord(options.metrics) || Object.keys(options.metrics).length === 0) throw new Error('Config is missing "options.metrics".')

  for (const [name, rawMetric] of Object.entries(options.metrics)) {
    if (!METRICS.has(name)) throw new Error(`Unknown metric "${name}".`)
    const thresholds = asThresholds(rawMetric, `options.metrics.${name}`)
    const metric = rawMetric as Record<string, unknown>
    if (metric.enabled !== undefined && typeof metric.enabled !== 'boolean') throw new Error(`"options.metrics.${name}.enabled" must be a boolean.`)
    if (!metric.enabled) continue

    const warning = thresholds.warning ?? defaults.warning
    const critical = thresholds.critical ?? defaults.critical
    const levels = thresholds.levels ?? defaults.levels
    if (warning === undefined || critical === undefined) throw new Error(`Enabled metric "${name}" needs warning and critical thresholds.`)
    if (warning > critical) throw new Error(`Metric "${name}" must have warning <= critical.`)
    if (!levels?.length) throw new Error(`Enabled metric "${name}" needs at least one display level.`)
  }

  if (config.includes !== undefined) asStringArray(config.includes, 'includes')
  if (config.excludes !== undefined) asStringArray(config.excludes, 'excludes')
  if (options.ignoreReExports !== undefined && typeof options.ignoreReExports !== 'boolean') throw new Error('"options.ignoreReExports" must be a boolean.')
  if (options.coverage !== undefined && typeof options.coverage !== 'string') throw new Error('"options.coverage" must be a string.')
  if (config.rules !== undefined) {
    if (!Array.isArray(config.rules)) throw new Error('"rules" must be an array.')
    for (const [index, rule] of config.rules.entries()) {
      if (!isRecord(rule)) throw new Error(`"rules.${index}" must be an object.`)
      assertGlob(rule.from, `rules.${index}.from`)
      const boundaries = Number(rule.cannotImport !== undefined) + Number(rule.canOnlyImport !== undefined)
      if (boundaries !== 1) throw new Error(`"rules.${index}" must define exactly one of cannotImport or canOnlyImport.`)
      if (rule.cannotImport !== undefined) assertGlob(rule.cannotImport, `rules.${index}.cannotImport`)
      if (rule.canOnlyImport !== undefined) assertGlob(rule.canOnlyImport, `rules.${index}.canOnlyImport`)
      if (rule.message !== undefined && typeof rule.message !== 'string') throw new Error(`"rules.${index}.message" must be a string.`)
    }
  }

  return config as unknown as ArtieConfig
}

export const writeConfig = (config: ArtieConfig): void => {
  writeFileSync(getConfigPath(), `${JSON.stringify(config, null, 2)}\n`)
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
  '--fail-on': { set: (options, value) => {
    const level = value.toUpperCase()
    if (level !== 'WARNING' && level !== 'CRITICAL') throw new Error('--fail-on must be warning or critical.')
    options.failOn = level
  } },
  '--save-baseline': { set: (options, value) => { options.saveBaseline = value }, default: DEFAULT_BASELINE },
  '--baseline': { set: (options, value) => { options.baseline = value }, default: DEFAULT_BASELINE },
  '--sarif': { set: (options, value) => { options.sarif = value }, default: 'artie-lens.sarif' },
  '--html': { set: (options, value) => { options.html = value }, default: 'artie-lens.html' },
  '--record': { set: (options, value) => { options.record = value }, default: DEFAULT_HISTORY },
  '--port': { set: (options, value) => {
    const port = Number(value)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be an integer between 1 and 65535.')
    options.port = value
  } },
  '--coverage': { set: (options, value) => { options.coverage = value }, default: DEFAULT_COVERAGE },
  '--against': { set: (options, value) => { options.against = value }, default: 'main' },
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
    if (!valueFlag) throw new Error(`Unknown option "${name}".`)

    const value = rest.join('=') || valueFlag.default
    if (value === undefined) throw new Error(`Option "${name}" requires a value.`)
    valueFlag.set(options, value)
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

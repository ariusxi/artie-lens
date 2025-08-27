import path from 'path'
import { existsSync, writeFileSync } from 'fs'

import { configTemplate } from './templates/config'
import { ArtieConfig, MetricConfig, MetricInsights, MetricResult } from './types/config.interface'
import { calculateCBO, calculateLCOM, calculateRFC, calculateWMC, metricInsights, printMetric, readFileContent } from './utils'

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

export function initConfig(): void {
  const filePath = path.resolve(process.cwd(), '.artierc.json')
  if (existsSync(filePath)) {
    return console.log("⚠️  The file .artierc.json already exists on the current directory.")
  }

  const configContent = JSON.stringify(configTemplate, null, 2)
  writeFileSync(filePath, configContent)

  console.log('✅ File .artierc.json created!')
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

export async function runLens(directory = process.cwd()): Promise<void> {
  const config = readConfig()
  const metrics = getEnableMetrics(config)

  const properties = {
    'cbo': calculateCBO,
    'rfc': calculateRFC,
    'lcom': calculateLCOM,
    'wmc': calculateWMC,
  }

  console.time('Total time')
  for (const metric of metrics) {
    const thresholds = getMetricConfig(metric)
    const result = await properties[metric](directory, thresholds, config.includes, config.excludes)
    
    console.log(`\n${metric.toUpperCase()}`)
    const indexes = getMetricIndexes(result)
    console.log(`📊 Metrics:`)
    console.log(`- Total: ${indexes.total}`)
    console.log(`- Average: ${indexes.average}`)
    console.log(`- Maximum: ${indexes.max}`)
    console.log(`- Minimum: ${indexes.min}`)
    console.log(`- Standard Deviation: ${indexes.deviation}`)

    if (indexes.total !== 0) {
      console.log('\nFiles:')
      for (const item of result) {
        if (thresholds.levels.includes(item.label)){
          printMetric(`[${item.label}] ${item.value} → ${item.total}`, item.label)

          const insight = metricInsights[metric][item.label]
          console.log(`   💡 ${insight}`)
        }
      } 
    }
    console.log('---')
  }
  console.timeEnd('Total time')
}

export function showHelp() {
  console.log('Artie-Lens\n')
  console.log('init - Initialize an .artierc.json file with default settings')
  console.log('run  - Run the lens for all metrics configured')
}

const main = async (args: string[]): Promise<void> => {
  const commands = {
    init: initConfig,
    run: runLens,
    help: showHelp,
  }

  const argument = args.slice(2)
  const parameter = argument[0]
  const directory = argument[1]

  if (parameter && parameter in commands) {
    await commands[parameter as keyof typeof commands](directory)
  } else {
    console.log('⚠️  Invalid command')
  }
}
main(process.argv)
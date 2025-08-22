import { resolve } from 'path'
import { existsSync, writeFileSync } from 'fs'

import { configTemplate } from './templates/config'
import { ArtieConfig, MetricConfig } from './types/config.interface'
import { calculateCBO, calculateLCOM, calculateRFC, calculateWMC, printMetric, readFileContent } from './utils'

export function readConfig(): ArtieConfig {
  const filePath = resolve(process.cwd(), '.artierc.json')
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

export function initConfig(): void {
  const filePath = resolve(process.cwd(), '.artierc.json')
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
    const total = result.reduce((accum, item) => 
      thresholds.levels.includes(item.label) ? accum + item.total : accum,
      0,
    )
    console.log(`${metric} - Total: ${total}`)

    for (const item of result) {
      if (thresholds.levels.includes(item.label)){
        printMetric(`[${item.label}] ${item.value}: ${item.total}`, item.label)
      }
    }
  }
  console.timeEnd('Total time')
}

export function showHelp() {
  console.log('Artie.JS\n')
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
import { resolve } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

import { configTemplate } from './templates/config'
import { ArtieConfig, MetricConfig } from './types/config.interface'

export function readConfig(): ArtieConfig {
  const filePath = resolve(process.cwd(), '.artierc.json')
  const config = readFileSync(filePath, 'utf-8')

  return JSON.parse(config)
}

export function initConfig(): void {
  const filePath = resolve(process.cwd(), '.artierc.json')
  if (existsSync(filePath)) {
    return console.log("⚠️  O arquivo .artierc.json já existe no diretório atual.")
  }

  const configContent = JSON.stringify(configTemplate, null, 2)
  writeFileSync(filePath, configContent)

  console.log('✅ Arquivo .artierc.json criado com sucesso!')
}

export async function getMetricConfig(metricName: string): Promise<MetricConfig> {
  const config = await readConfig()
  console.dir({ config }, { depth: null })

  const defaults = config.options.defaultThresholds
  const metric = config.options.metrics[metricName.toLowerCase()]

  if (!metric) {
    throw new Error(`Métrica ${metricName} não encontrada.`)
  }

  if (!metric.enabled) {
    return { enabled: false }
  }

  return {
    enabled: metric.enabled,
    warning: metric.warning ?? defaults.warning,
    critical: metric.critical ?? defaults.critical,
  }
}

export async function runLens(): Promise<void> {
  const metrics = ['wmc', 'lcom', 'cbo', 'rfc']

  const config = {} as any
  for (const metric of metrics) {
    config[metric] = await getMetricConfig(metric)
  }
}

const main = async (args: string[]): Promise<void> => {
  const commands = {
    init: initConfig,
    run: runLens,
  }

  const argument = args.slice(2)
  const parameter = argument[0]

  if (parameter && parameter in commands) {
    await commands[parameter as keyof typeof commands]()
  } else {
    console.log('⚠️ Comando inválido')
  }
}
main(process.argv)
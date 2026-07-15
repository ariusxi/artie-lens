import { RunOptions } from './types/config.interface'
import { parseRunOptions } from './helpers/config.helpers'
import { initConfig } from './routines/init.routine'
import { showHelp } from './routines/help.routine'
import { runLens } from './routines/run.routine'
import { watchLens } from './routines/watch.routine'
import { suggestLens } from './routines/suggest.routine'
import { hotspotLens } from './routines/hotspots.routine'

type Command = (directory: string | undefined, options: RunOptions) => void | Promise<void>

const runCommand: Command = async (directory, options) => {
  // Deprecated flag aliases, kept so `run --watch` and friends keep working
  if (options.watch) return watchLens(directory, options)
  if (options.suggest) return suggestLens(directory)
  if (options.hotspots) return hotspotLens(directory, options)

  const report = await runLens(directory, options)
  if (!report.failed) return

  process.exitCode = 1
}

const commands: Record<string, Command> = {
  init: () => initConfig(),
  help: () => showHelp(),
  run: runCommand,
  watch: (directory, options) => watchLens(directory, options),
  suggest: (directory) => suggestLens(directory),
  hotspots: (directory, options) => hotspotLens(directory, options),
}

const main = async (args: string[]): Promise<void> => {
  const [command, ...rest] = args.slice(2)
  const directory = rest.find((arg) => !arg.startsWith('--'))
  const options = parseRunOptions(rest.filter((arg) => arg.startsWith('--')))

  const handler = commands[command]
  if (!handler) return console.log('⚠️  Invalid command. Run `artie help` to see the available commands.')

  try {
    await handler(directory, options)
  } catch (error) {
    console.error(`⚠️  ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  }
}

main(process.argv)

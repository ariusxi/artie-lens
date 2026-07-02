import { RunOptions } from './types/config.interface'
import { parseRunOptions } from './helpers/config.helpers'
import { initConfig } from './routines/init.routine'
import { showHelp } from './routines/help.routine'
import { runLens, suggestLens, watchLens } from './routines/run.routine'

const runCommand = async (directory: string | undefined, options: RunOptions): Promise<void> => {
  if (options.watch) return watchLens(directory, options)
  if (options.suggest) return suggestLens(directory)

  const report = await runLens(directory, options)
  if (!report.failed) return

  process.exitCode = 1
}

const main = async (args: string[]): Promise<void> => {
  const [command, ...rest] = args.slice(2)
  const directory = rest.find((arg) => !arg.startsWith('--'))
  const options = parseRunOptions(rest.filter((arg) => arg.startsWith('--')))

  const commands: Record<string, () => void | Promise<void>> = {
    init: () => initConfig(),
    help: () => showHelp(),
    run: () => runCommand(directory, options),
  }

  const handler = commands[command]
  if (!handler) return console.log('⚠️  Invalid command')

  await handler()
}

main(process.argv)

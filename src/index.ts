import { showHelp } from './routines/help.routine'
import { initConfig } from './routines/init.routine'
import { runLens } from './routines/run.routine'
import { parseRunOptions } from './helpers/configHelpers'

const main = async (args: string[]): Promise<void> => {
  const argument = args.slice(2)
  const parameter = argument[0]

  const rest = argument.slice(1)
  const directory = rest.find((arg) => !arg.startsWith('--'))
  const options = parseRunOptions(rest.filter((arg) => arg.startsWith('--')))

  switch (parameter) {
    case 'init':
      return initConfig()
    case 'help':
      return showHelp()
    case 'run': {
      const report = await runLens(directory, options)
      if (report.failed) process.exitCode = 1
      return
    }
    default:
      console.log('⚠️  Invalid command')
  }
}
main(process.argv)
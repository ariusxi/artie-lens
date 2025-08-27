import { showHelp } from './routines/help.routine'
import { initConfig } from './routines/init.routine'
import { runLens } from './routines/run.routine'

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
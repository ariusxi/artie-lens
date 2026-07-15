import { watch } from 'chokidar'

import { RunOptions } from '../types/config.interface'
import { runLens } from './run.routine'

const WATCH_DEBOUNCE_MS = 200

export const watchLens = (directory = process.cwd(), options: RunOptions = {}): void => {
  const trigger = () => {
    console.clear()
    console.log('artie-lens watching for changes. Press Ctrl+C to stop.\n')
    runLens(directory, { ...options, watch: false, json: false, failOn: undefined }).catch((error) => console.error(error))
  }

  trigger()

  let timer: ReturnType<typeof setTimeout> | undefined
  const watcher = watch(directory, {
    ignored: (path) => path.includes('node_modules') || path.includes('/.git/'),
    ignoreInitial: true,
  })

  watcher.on('all', (_event, path) => {
    if (!path.endsWith('.ts')) return
    clearTimeout(timer)
    timer = setTimeout(trigger, WATCH_DEBOUNCE_MS)
  })
}

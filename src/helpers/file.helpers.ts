import fg from 'fast-glob'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export const getSourceFiles = (directory: string, includes: string[], excludes: string[]): Promise<string[]> =>
  fg(includes, {
    cwd: directory,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: excludes,
  })

export const readFileContent = (directory: string): string => readFileSync(directory, 'utf-8')

export const findTsConfig = (directory: string): string | undefined => {
  const path = join(directory, 'tsconfig.json')
  return existsSync(path) ? path : undefined
}

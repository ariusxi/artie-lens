import fg from 'fast-glob'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export async function getSourceFiles(directory: string, includes: string[], excludes: string[]): Promise<string[]> {
  return await fg(includes, {
    cwd: directory,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: excludes,
  })
}

export function readFileContent(directory: string): string {
  return readFileSync(directory, 'utf-8')
}

export function findTsConfig(directory: string): string | undefined {
  const path = join(directory, 'tsconfig.json')
  return existsSync(path) ? path : undefined
}

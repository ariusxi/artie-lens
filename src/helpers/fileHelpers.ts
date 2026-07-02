import fg from 'fast-glob'
import { readFileSync } from 'fs'

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

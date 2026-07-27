import { existsSync, readFileSync } from 'fs'
import { isAbsolute, relative, resolve } from 'path'

export const DEFAULT_COVERAGE = 'coverage/lcov.info'

export interface FileCoverage {
  lines: number
  hit: number
  pct: number
}

// Parses an lcov report into per-file line coverage. LF/LH (found/hit totals) are used when
// present; otherwise the DA (per-line hit) records are counted, so partial lcov still works.
export const parseLcov = (content: string): Map<string, FileCoverage> => {
  const result = new Map<string, FileCoverage>()
  let file: string | null = null
  let da = 0
  let daHit = 0
  let found = -1
  let hit = -1

  const flush = (): void => {
    if (file !== null) {
      const lines = found >= 0 ? found : da
      const covered = hit >= 0 ? hit : daHit
      result.set(file, { lines, hit: covered, pct: lines > 0 ? (covered / lines) * 100 : 100 })
    }
    file = null
    da = 0
    daHit = 0
    found = -1
    hit = -1
  }

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('SF:')) {
      flush()
      file = line.slice(3)
      continue
    }
    if (line.startsWith('DA:')) {
      da += 1
      if (Number(line.slice(3).split(',')[1]) > 0) daHit += 1
      continue
    }
    if (line.startsWith('LF:')) found = Number(line.slice(3))
    if (line.startsWith('LH:')) hit = Number(line.slice(3))
    if (line === 'end_of_record') flush()
  }

  flush()
  return result
}

// Reads the lcov file and returns line-coverage percentages keyed by path relative to the analyzed
// directory, so they line up with the metric report's file paths.
export const readCoverage = (path: string, directory: string): Map<string, number> => {
  if (!existsSync(path)) return new Map()

  const byFile = new Map<string, number>()
  for (const [sourceFile, coverage] of parseLcov(readFileSync(path, 'utf-8'))) {
    const absolute = isAbsolute(sourceFile) ? sourceFile : resolve(directory, sourceFile)
    byFile.set(relative(directory, absolute), coverage.pct)
  }

  return byFile
}

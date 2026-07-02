import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

import { MetricConfig, MetricResult } from '../src/types/config.interface'

const createdDirs: string[] = []

/** Writes the given files into a fresh temp directory and returns its path. */
export function createProject(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'artie-lens-'))

  for (const [name, content] of Object.entries(files)) {
    const fullPath = join(directory, name)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, content)
  }

  createdDirs.push(directory)
  return directory
}

/** Removes every temp directory created during the tests. */
export function cleanupProjects(): void {
  while (createdDirs.length) {
    rmSync(createdDirs.pop()!, { recursive: true, force: true })
  }
}

export const thresholds: MetricConfig = {
  enabled: true,
  warning: 10,
  critical: 20,
  levels: ['OK', 'WARNING', 'CRITICAL'],
}

export function totalOf(results: MetricResult[], className: string): number | undefined {
  return results.find((result) => result.value === className)?.total
}

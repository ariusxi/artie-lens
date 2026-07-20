import { spawnSync } from 'child_process'
import { realpathSync } from 'fs'
import { join, relative } from 'path'

export const DEFAULT_SINCE = '90 days ago'

// Arguments are passed as an array (never through a shell), so nothing here is interpolated
// into a command string.
const runGit = (directory: string, args: string[]): string | null => {
  const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf-8' })
  if (result.status !== 0) return null

  return result.stdout
}

export const getRepositoryRoot = (directory: string): string | null => {
  const output = runGit(directory, ['rev-parse', '--show-toplevel'])
  if (!output) return null

  return output.trim()
}

export const getCurrentCommit = (directory: string): string => {
  const output = runGit(directory, ['rev-parse', '--short', 'HEAD'])
  return output ? output.trim() : 'unknown'
}

// Counts how many commits touched each file in the given window. Returns paths relative to
// the analyzed directory, or null when the directory is not a git repository.
export const getChurn = (directory: string, since: string): Map<string, number> | null => {
  const root = getRepositoryRoot(directory)
  if (!root) return null

  const output = runGit(directory, ['log', `--since=${since}`, '--name-only', '--format='])
  if (output === null) return null

  // git resolves symlinks (on macOS /var is a symlink to /private/var), so the analyzed
  // directory has to be resolved too or the relative paths will not line up.
  const base = realpathSync(directory)
  const churn = new Map<string, number>()

  for (const line of output.split('\n')) {
    const path = line.trim()
    if (!path) continue

    const file = relative(base, join(root, path))
    churn.set(file, (churn.get(file) ?? 0) + 1)
  }

  return churn
}

import { spawnSync } from 'child_process'
import { randomBytes } from 'crypto'
import { tmpdir } from 'os'
import { join } from 'path'
import { normalizeReportPath } from './file.helpers'

export const DEFAULT_SINCE = '90 days ago'

// Arguments are passed as an array (never through a shell), so nothing here is interpolated
// into a command string.
const runGit = (directory: string, args: string[]): string | null => {
  const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf-8' })
  if (result.status !== 0) return null

  return result.stdout
}

// Checks out a ref into a throwaway detached worktree so it can be analyzed without touching the
// working tree. Returns the worktree path, or null when the ref or repository is invalid.
export const addWorktree = (directory: string, ref: string): string | null => {
  const path = join(tmpdir(), `artie-wt-${randomBytes(6).toString('hex')}`)
  return runGit(directory, ['worktree', 'add', '--detach', path, ref]) === null ? null : path
}

export const removeWorktree = (directory: string, path: string): void => {
  runGit(directory, ['worktree', 'remove', '--force', path])
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
  const prefixOutput = runGit(directory, ['rev-parse', '--show-prefix'])
  if (prefixOutput === null) return null
  const prefix = normalizeReportPath(prefixOutput.trim())

  const output = runGit(directory, ['log', `--since=${since}`, '--name-only', '--format=', '--', '.'])
  if (output === null) return null

  const churn = new Map<string, number>()

  for (const line of output.split('\n')) {
    const path = normalizeReportPath(line.trim())
    if (!path) continue
    if (prefix && !path.startsWith(prefix)) continue

    const file = prefix ? path.slice(prefix.length) : path
    churn.set(file, (churn.get(file) ?? 0) + 1)
  }

  return churn
}

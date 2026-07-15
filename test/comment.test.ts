import { existsSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import { COMMENT_MARKER, buildCommentBody } from '../src/helpers/comment.helpers'
import { getPullRequestContext } from '../src/helpers/github.helpers'
import { Regression, RuleViolation } from '../src/types/config.interface'

const regression = (metric: string, value: string): Regression =>
  ({ metric, value, from: 'OK', to: 'WARNING', fromTotal: 8, toTotal: 12 })

const violation = (from: string, to: string): RuleViolation => ({ from, to, message: `${from} must not import ${to}` })

describe('buildCommentBody', () => {
  it('reports a clean result', () => {
    const body = buildCommentBody([], [])

    expect(body.startsWith(COMMENT_MARKER)).toBe(true)
    expect(body).toContain('✅ No new regressions or architecture violations.')
  })

  it('lists violations and regressions with a count', () => {
    const body = buildCommentBody([regression('wmc', 'OrderService')], [violation('src/domain/a.ts', 'src/infra/b.ts')])

    expect(body).toContain('❌ 2 issue(s) to review.')
    expect(body).toContain('Architecture violations (1)')
    expect(body).toContain('`src/domain/a.ts` → `src/infra/b.ts`')
    expect(body).toContain('Regressions vs baseline (1)')
    expect(body).toContain('WMC `OrderService`: OK 8 → WARNING 12')
  })
})

describe('getPullRequestContext', () => {
  it('returns null without token or repository', () => {
    expect(getPullRequestContext({})).toBeNull()
    expect(getPullRequestContext({ GITHUB_TOKEN: 't' })).toBeNull()
  })

  it('reads the PR number from the ref', () => {
    const context = getPullRequestContext({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'me/repo', GITHUB_REF: 'refs/pull/42/merge' })

    expect(context).toEqual({ token: 't', owner: 'me', repo: 'repo', pr: 42 })
  })

  it('reads the PR number from the event payload', () => {
    const dir = mkdtempSync(join(tmpdir(), 'artie-event-'))
    const eventPath = join(dir, 'event.json')
    writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 7 } }))

    const context = getPullRequestContext({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'me/repo', GITHUB_EVENT_PATH: eventPath })

    expect(existsSync(eventPath)).toBe(true)
    expect(context?.pr).toBe(7)
  })
})

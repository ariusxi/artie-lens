import { describe, expect, it } from 'vitest'

import { hasDashboardAccess, shouldRefreshDashboard } from '../src/routines/dashboard.routine'

const request = (token?: string) => ({ headers: token ? { 'x-artie-token': token } : {} })

describe('dashboard access token', () => {
  it('accepts the token in the request header', () => {
    expect(hasDashboardAccess(request('secret'), new URL('http://localhost/dead'), 'secret')).toBe(true)
  })

  it('accepts the token in the query string for EventSource', () => {
    expect(hasDashboardAccess(request(), new URL('http://localhost/events?token=secret'), 'secret')).toBe(true)
  })

  it('rejects missing and incorrect tokens', () => {
    expect(hasDashboardAccess(request(), new URL('http://localhost/dead'), 'secret')).toBe(false)
    expect(hasDashboardAccess(request('wrong'), new URL('http://localhost/dead'), 'secret')).toBe(false)
  })
})

describe('dashboard refresh inputs', () => {
  it('watches source, config, compiler, coverage, and history files', () => {
    const root = '/project'
    expect(shouldRefreshDashboard('/project/src/a.tsx', root, {})).toBe(true)
    expect(shouldRefreshDashboard('/project/.artierc.json', root, {})).toBe(true)
    expect(shouldRefreshDashboard('/project/tsconfig.json', root, {})).toBe(true)
    expect(shouldRefreshDashboard('/project/coverage/lcov.info', root, {})).toBe(true)
    expect(shouldRefreshDashboard('/project/.artie-history.json', root, {})).toBe(true)
    expect(shouldRefreshDashboard('/project/README.md', root, {})).toBe(false)
  })
})

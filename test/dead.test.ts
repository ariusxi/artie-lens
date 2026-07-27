import { afterAll, describe, expect, it } from 'vitest'

import { buildAnalysisContext } from '../src/helpers/metric.helpers'
import { findDeadExports } from '../src/helpers/dead.helpers'
import { cleanupProjects, createProject } from './utils'

afterAll(cleanupProjects)

const contextFrom = async (files: Record<string, string>) => {
  const directory = createProject(files)
  const context = await buildAnalysisContext(directory, ['**/*.ts'], [])
  return context!
}

describe('findDeadExports', () => {
  it('flags exports nothing imports while sparing used and internally-used ones', async () => {
    const context = await contextFrom({
      'a.ts': 'export const usedFn = () => 1\nexport const deadFn = () => 2\nexport interface UsedType { x: number }\nexport interface DeadType { y: number }\n',
      'b.ts': "import { usedFn, UsedType } from './a'\nexport const run = (): UsedType => ({ x: usedFn() })\n",
      'c.ts': 'export const onlyLocal = () => 1\nexport const localCaller = () => onlyLocal()\n',
    })

    const names = findDeadExports(context).map((item) => item.name)

    expect(names).toContain('deadFn') // exported, never imported
    expect(names).toContain('DeadType') // exported type, never referenced
    expect(names).toContain('run') // exported in b.ts, imported nowhere
    expect(names).toContain('localCaller') // never called
    expect(names).not.toContain('usedFn') // imported by b.ts
    expect(names).not.toContain('UsedType') // used as a return type in b.ts
    expect(names).not.toContain('onlyLocal') // used within its own file
  })

  it('reports the kind and location of each dead export', async () => {
    const context = await contextFrom({ 'x.ts': 'export class Orphan {}\n' })
    const [dead] = findDeadExports(context)

    expect(dead).toMatchObject({ name: 'Orphan', kind: 'class', file: 'x.ts', line: 1 })
  })

  it('skips files matching the entries globs', async () => {
    const context = await contextFrom({ 'index.ts': 'export const api = () => 1\n' })

    expect(findDeadExports(context).map((item) => item.name)).toContain('api')
    expect(findDeadExports(context, ['index.ts']).map((item) => item.name)).not.toContain('api')
  })
})

import { Project } from 'ts-morph'
import { describe, expect, it } from 'vitest'

import { computeMartin } from '../src/helpers/martin.helpers'

const projectFrom = (files: Record<string, string>) => {
  const project = new Project({ useInMemoryFileSystem: true })
  for (const [name, content] of Object.entries(files)) project.createSourceFile(name, content)
  return project.getSourceFiles()
}

const graph = (edges: Record<string, string[]>): Map<string, Set<string>> =>
  new Map(Object.entries(edges).map(([node, deps]) => [`/${node}`, new Set(deps.map((dep) => `/${dep}`))]))

describe('computeMartin', () => {
  it('computes afferent, efferent and instability', () => {
    const sources = projectFrom({ 'a.ts': 'export const a = 1', 'b.ts': 'export const b = 1', 'c.ts': 'export const c = 1' })
    const martin = computeMartin(graph({ 'a.ts': ['b.ts', 'c.ts'], 'b.ts': ['c.ts'], 'c.ts': [] }), sources)

    // c is imported by a and b, imports nothing: fully stable
    expect(martin.get('/c.ts')).toMatchObject({ ca: 2, ce: 0, instability: 0 })
    // a imports two, is imported by none: fully unstable
    expect(martin.get('/a.ts')).toMatchObject({ ca: 0, ce: 2, instability: 1 })
  })

  it('is far from the main sequence for a concrete, widely-depended-on module', () => {
    const sources = projectFrom({ 'core.ts': 'export class Core {}', 'x.ts': 'export const x = 1' })
    // core is concrete (A=0) and stable (I=0): D = |0 + 0 - 1| = 1
    const martin = computeMartin(graph({ 'x.ts': ['core.ts'], 'core.ts': [] }), sources)

    expect(martin.get('/core.ts')?.abstractness).toBe(0)
    expect(martin.get('/core.ts')?.distance).toBe(1)
  })

  it('is on the main sequence for an abstract, stable module', () => {
    const sources = projectFrom({ 'port.ts': 'export interface Port {}', 'x.ts': 'export const x = 1' })
    // port is abstract (A=1) and stable (I=0): D = |1 + 0 - 1| = 0
    const martin = computeMartin(graph({ 'x.ts': ['port.ts'], 'port.ts': [] }), sources)

    expect(martin.get('/port.ts')?.abstractness).toBe(1)
    expect(martin.get('/port.ts')?.distance).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'

import { findCycleSizes } from '../src/helpers/moduleHelpers'

const graph = (edges: Record<string, string[]>): Map<string, Set<string>> =>
  new Map(Object.entries(edges).map(([node, deps]) => [node, new Set(deps)]))

describe('findCycleSizes', () => {
  it('marks every node of a cycle with the cycle size', () => {
    const sizes = findCycleSizes(graph({ a: ['b'], b: ['c'], c: ['a'] }))

    expect(sizes.get('a')).toBe(3)
    expect(sizes.get('b')).toBe(3)
    expect(sizes.get('c')).toBe(3)
  })

  it('returns nothing for an acyclic graph', () => {
    const sizes = findCycleSizes(graph({ a: ['b'], b: ['c'], c: [] }))

    expect(sizes.size).toBe(0)
  })

  it('detects a self-import', () => {
    const sizes = findCycleSizes(graph({ a: ['a'] }))

    expect(sizes.get('a')).toBe(1)
  })

  it('handles two disjoint cycles and leaves standalone nodes out', () => {
    const sizes = findCycleSizes(graph({ a: ['b'], b: ['a'], c: ['d'], d: ['c'], e: [] }))

    expect(sizes.get('a')).toBe(2)
    expect(sizes.get('c')).toBe(2)
    expect(sizes.has('e')).toBe(false)
  })
})

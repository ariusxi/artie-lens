import { describe, expect, it } from 'vitest'

import { computeSeams, findCommunities } from '../src/helpers/seam.helpers'

const graph = (edges: Record<string, string[]>): Map<string, Set<string>> =>
  new Map(Object.entries(edges).map(([node, deps]) => [node, new Set(deps)]))

describe('findCommunities', () => {
  it('separates two clusters linked by a single edge', () => {
    const community = findCommunities(graph({
      a: ['b', 'c'], b: ['c', 'a'], c: ['a', 'b', 'd'],
      d: ['e', 'f'], e: ['f', 'd'], f: ['d', 'e'],
    }))

    // a, b, c share one community and d, e, f another
    expect(community.get('a')).toBe(community.get('b'))
    expect(community.get('a')).toBe(community.get('c'))
    expect(community.get('d')).toBe(community.get('e'))
    expect(community.get('d')).toBe(community.get('f'))
    expect(community.get('a')).not.toBe(community.get('d'))
  })
})

describe('computeSeams', () => {
  it('reports internal cohesion and boundary crossings for each community', () => {
    const g = graph({
      a: ['b', 'c'], b: ['c', 'a'], c: ['a', 'b', 'd'],
      d: ['e', 'f'], e: ['f', 'd'], f: ['d', 'e'],
    })
    const seams = computeSeams(g, findCommunities(g))

    expect(seams).toHaveLength(2)
    expect(seams.map((seam) => seam.modules.join(',')).sort()).toEqual(['a,b,c', 'd,e,f'])
    // a single edge (c -> d) crosses the boundary, counted for both communities
    for (const seam of seams) {
      expect(seam.internal).toBe(6)
      expect(seam.crossing).toBe(1)
    }
  })

  it('ranks substantial, loosely coupled seams first', () => {
    // hub cluster {a,b} links to two leaf clusters, so it is more coupled than either leaf
    const g = graph({
      a: ['b', 'c', 'e'], b: ['a'],
      c: ['d'], d: ['c'],
      e: ['f'], f: ['e'],
    })
    const seams = computeSeams(g, findCommunities(g))

    expect(seams.length).toBeGreaterThanOrEqual(2)
    const quality = (seam: (typeof seams)[number]) => seam.internal / (seam.crossing + 1)
    for (let i = 1; i < seams.length; i++) {
      expect(quality(seams[i - 1])).toBeGreaterThanOrEqual(quality(seams[i]))
    }
  })

  it('ignores singleton communities', () => {
    const g = graph({ lonely: [], a: ['b'], b: ['a'] })
    const seams = computeSeams(g, findCommunities(g))

    expect(seams.every((seam) => seam.modules.length >= 2)).toBe(true)
    expect(seams.some((seam) => seam.modules.includes('lonely'))).toBe(false)
  })
})

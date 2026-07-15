import { Seam } from '../types/config.interface'

const MAX_ITERATIONS = 20

// One level of the Louvain method: assign each module to a community by greedily maximizing
// modularity. Imports are treated as undirected edges (coupling regardless of direction).
export const findCommunities = (graph: Map<string, Set<string>>): Map<string, number> => {
  const neighbors = new Map<string, Map<string, number>>()

  const link = (a: string, b: string): void => {
    if (a === b) return
    if (!neighbors.has(a)) neighbors.set(a, new Map())
    const edges = neighbors.get(a)!
    edges.set(b, (edges.get(b) ?? 0) + 1)
  }

  for (const [node, dependencies] of graph) {
    if (!neighbors.has(node)) neighbors.set(node, new Map())
    for (const dependency of dependencies) {
      link(node, dependency)
      link(dependency, node)
    }
  }

  const nodes = [...neighbors.keys()].sort()
  const degree = new Map<string, number>()
  for (const node of nodes) {
    degree.set(node, [...neighbors.get(node)!.values()].reduce((sum, weight) => sum + weight, 0))
  }

  const community = new Map<string, number>()
  nodes.forEach((node, index) => community.set(node, index))

  const totalDegree = [...degree.values()].reduce((sum, value) => sum + value, 0)
  if (totalDegree === 0) return community

  const communityDegree = new Map<number, number>()
  nodes.forEach((node, index) => communityDegree.set(index, degree.get(node)!))

  let improved = true
  let iterations = 0

  while (improved && iterations < MAX_ITERATIONS) {
    improved = false
    iterations += 1

    for (const node of nodes) {
      const nodeDegree = degree.get(node)!
      const current = community.get(node)!
      communityDegree.set(current, communityDegree.get(current)! - nodeDegree)

      const edgesToCommunity = new Map<number, number>()
      for (const [neighbor, weight] of neighbors.get(node)!) {
        const target = community.get(neighbor)!
        edgesToCommunity.set(target, (edgesToCommunity.get(target) ?? 0) + weight)
      }

      let best = current
      let bestGain = 0
      for (const candidate of new Set([...edgesToCommunity.keys(), current])) {
        const edgesIn = edgesToCommunity.get(candidate) ?? 0
        const gain = edgesIn - (nodeDegree * (communityDegree.get(candidate) ?? 0)) / totalDegree
        if (gain > bestGain || (gain === bestGain && candidate < best)) {
          bestGain = gain
          best = candidate
        }
      }

      community.set(node, best)
      communityDegree.set(best, (communityDegree.get(best) ?? 0) + nodeDegree)
      if (best !== current) improved = true
    }
  }

  return community
}

// For each community, counts dependencies that stay inside (cohesion) versus those that cross
// a community boundary (coupling). A clean seam has many internal and few crossing edges.
export const computeSeams = (graph: Map<string, Set<string>>, community: Map<string, number>): Seam[] => {
  const members = new Map<number, string[]>()
  for (const [node, id] of community) {
    if (!members.has(id)) members.set(id, [])
    members.get(id)!.push(node)
  }

  const internal = new Map<number, number>()
  const crossing = new Map<number, number>()

  for (const [from, dependencies] of graph) {
    const fromId = community.get(from)!
    for (const to of dependencies) {
      const toId = community.get(to)!
      if (fromId === toId) {
        internal.set(fromId, (internal.get(fromId) ?? 0) + 1)
        continue
      }
      crossing.set(fromId, (crossing.get(fromId) ?? 0) + 1)
      crossing.set(toId, (crossing.get(toId) ?? 0) + 1)
    }
  }

  const seams: Seam[] = []
  for (const [id, modules] of members) {
    if (modules.length < 2) continue
    seams.push({ modules: modules.sort(), internal: internal.get(id) ?? 0, crossing: crossing.get(id) ?? 0 })
  }

  // Best extraction candidates first: substantial and loosely coupled, so rank by the ratio
  // of internal cohesion to boundary crossings. A big cohesive cluster beats a trivial pair.
  const quality = (seam: Seam): number => seam.internal / (seam.crossing + 1)
  return seams.sort((a, b) => quality(b) - quality(a) || b.internal - a.internal)
}

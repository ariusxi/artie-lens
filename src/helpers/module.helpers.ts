import { Project } from 'ts-morph'

export const buildModuleGraph = (project: Project, includedPaths: Set<string>): Map<string, Set<string>> => {
  const graph = new Map<string, Set<string>>()

  for (const sourceFile of project.getSourceFiles()) {
    const path = sourceFile.getFilePath()
    if (!includedPaths.has(path)) continue

    const dependencies = new Set<string>()
    const specifiers = [...sourceFile.getImportDeclarations(), ...sourceFile.getExportDeclarations()]

    for (const specifier of specifiers) {
      const target = specifier.getModuleSpecifierSourceFile()
      if (!target) continue

      const targetPath = target.getFilePath()
      if (targetPath !== path && includedPaths.has(targetPath)) dependencies.add(targetPath)
    }

    graph.set(path, dependencies)
  }

  return graph
}

// Tarjan's strongly connected components: a node belongs to an import cycle when its
// SCC has more than one member (or it imports itself). Returns the cyclic groups.
export const findCycleGroups = (graph: Map<string, Set<string>>): string[][] => {
  const indices = new Map<string, number>()
  const lowlinks = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const groups: string[][] = []
  let counter = 0

  const strongConnect = (node: string): void => {
    indices.set(node, counter)
    lowlinks.set(node, counter)
    counter += 1
    stack.push(node)
    onStack.add(node)

    for (const next of graph.get(node) ?? []) {
      if (!indices.has(next)) {
        strongConnect(next)
        lowlinks.set(node, Math.min(lowlinks.get(node)!, lowlinks.get(next)!))
        continue
      }
      if (onStack.has(next)) lowlinks.set(node, Math.min(lowlinks.get(node)!, indices.get(next)!))
    }

    if (lowlinks.get(node) !== indices.get(node)) return

    const component: string[] = []
    let member: string
    do {
      member = stack.pop()!
      onStack.delete(member)
      component.push(member)
    } while (member !== node)

    if (component.length > 1 || graph.get(node)?.has(node)) groups.push(component)
  }

  for (const node of graph.keys()) {
    if (!indices.has(node)) strongConnect(node)
  }

  return groups
}

export const findCycleSizes = (graph: Map<string, Set<string>>): Map<string, number> => {
  const cycleSizes = new Map<string, number>()

  for (const group of findCycleGroups(graph)) {
    for (const member of group) cycleSizes.set(member, group.length)
  }

  return cycleSizes
}

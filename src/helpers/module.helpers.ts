import { ExportDeclaration, ImportDeclaration, Project } from 'ts-morph'

// Type-only imports/exports are erased at compile time, so they create neither runtime
// coupling nor runtime cycles. Only edges that survive to runtime count.
const isRuntimeImport = (declaration: ImportDeclaration): boolean => {
  if (declaration.isTypeOnly()) return false
  if (declaration.getDefaultImport() || declaration.getNamespaceImport()) return true

  const named = declaration.getNamedImports()
  if (named.length === 0) return true // side-effect import: import './x'

  return named.some((specifier) => !specifier.isTypeOnly())
}

const isRuntimeExport = (declaration: ExportDeclaration): boolean => {
  if (declaration.isTypeOnly()) return false

  const named = declaration.getNamedExports()
  if (named.length === 0) return true // export * from './x'

  return named.some((specifier) => !specifier.isTypeOnly())
}

export const buildModuleGraph = (project: Project, includedPaths: Set<string>, ignoreReExports = false): Map<string, Set<string>> => {
  const graph = new Map<string, Set<string>>()

  for (const sourceFile of project.getSourceFiles()) {
    const path = sourceFile.getFilePath()
    if (!includedPaths.has(path)) continue

    const dependencies = new Set<string>()
    const runtimeImports = sourceFile.getImportDeclarations().filter(isRuntimeImport)
    // Re-exports (barrels) are pass-throughs; ignoring them breaks hub cycles at the cost
    // of the transitive edge they carried.
    const runtimeExports = ignoreReExports ? [] : sourceFile.getExportDeclarations().filter(isRuntimeExport)

    for (const declaration of [...runtimeImports, ...runtimeExports]) {
      const target = declaration.getModuleSpecifierSourceFile()
      if (!target) continue

      const targetPath = target.getFilePath()
      if (targetPath !== path && includedPaths.has(targetPath)) dependencies.add(targetPath)
    }

    graph.set(path, dependencies)
  }

  return graph
}

// Extracts one concrete cycle (a real loop of edges) from within a strongly connected
// component, so the output can show the path instead of just the member count.
export const findCyclePath = (graph: Map<string, Set<string>>, members: string[]): string[] => {
  const memberSet = new Set(members)
  const path: string[] = []
  const onPath = new Set<string>()

  const walk = (node: string): string[] | null => {
    path.push(node)
    onPath.add(node)

    for (const next of graph.get(node) ?? []) {
      if (!memberSet.has(next)) continue
      if (onPath.has(next)) return [...path.slice(path.indexOf(next)), next]

      const found = walk(next)
      if (found) return found
    }

    path.pop()
    onPath.delete(node)
    return null
  }

  return walk(members[0]) ?? [members[0]]
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

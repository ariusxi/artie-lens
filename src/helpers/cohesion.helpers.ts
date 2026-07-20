import { ClassDeclaration, Node, SyntaxKind } from 'ts-morph'

import { isFunctionInitializer } from './ast.helpers'

interface MethodUsage {
  name: string
  variables: Set<string>
}

const getInstanceVariableNames = (classDeclaration: ClassDeclaration): Set<string> => {
  const names = new Set<string>()

  for (const property of classDeclaration.getProperties()) {
    // Arrow-function/function fields are behavior, not data — they are treated as methods below
    if (property.isStatic() || isFunctionInitializer(property.getInitializer())) continue
    names.add(property.getName())
  }

  // Parameter properties (e.g. `constructor(private repo: Repo)`) are instance variables too
  for (const constructor of classDeclaration.getConstructors()) {
    for (const parameter of constructor.getParameters()) {
      if (parameter.hasScopeKeyword() || parameter.isReadonly()) names.add(parameter.getName())
    }
  }

  return names
}

const getUsedInstanceVariables = (method: Node, instanceVariables: Set<string>): Set<string> => {
  const used = new Set<string>()

  for (const access of method.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (access.getExpression().getKind() !== SyntaxKind.ThisKeyword) continue
    const name = access.getName()
    if (instanceVariables.has(name)) used.add(name)
  }

  for (const access of method.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)) {
    if (access.getExpression().getKind() !== SyntaxKind.ThisKeyword) continue
    const argument = access.getArgumentExpression()
    if (argument && Node.isStringLiteral(argument) && instanceVariables.has(argument.getLiteralValue())) {
      used.add(argument.getLiteralValue())
    }
  }

  return used
}

const getMethodUsages = (classDeclaration: ClassDeclaration): MethodUsage[] => {
  const instanceVariables = getInstanceVariableNames(classDeclaration)
  const usages: MethodUsage[] = []

  for (const method of classDeclaration.getMethods()) {
    if (method.isStatic() || method.isOverload()) continue
    usages.push({ name: method.getName(), variables: getUsedInstanceVariables(method, instanceVariables) })
  }
  for (const accessor of [...classDeclaration.getGetAccessors(), ...classDeclaration.getSetAccessors()]) {
    if (accessor.isStatic()) continue
    usages.push({ name: accessor.getName(), variables: getUsedInstanceVariables(accessor, instanceVariables) })
  }
  for (const property of classDeclaration.getProperties()) {
    if (property.isStatic() || !isFunctionInitializer(property.getInitializer())) continue
    usages.push({ name: property.getName(), variables: getUsedInstanceVariables(property.getInitializerOrThrow(), instanceVariables) })
  }

  return usages
}

export const getCohesionLength = (classDeclaration: ClassDeclaration): number => {
  const usages = getMethodUsages(classDeclaration)
  if (usages.length < 2) return 0

  const usedPerMethod = usages.map((usage) => usage.variables)

  // CK paper: if no method uses any instance variable, LCOM is 0
  if (usedPerMethod.every((used) => used.size === 0)) return 0

  let shared = 0
  let unshared = 0

  for (let i = 0; i < usedPerMethod.length; i++) {
    for (let j = i + 1; j < usedPerMethod.length; j++) {
      const intersects = [...usedPerMethod[i]].some((name) => usedPerMethod[j].has(name))
      if (intersects) {
        shared += 1
        continue
      }
      unshared += 1
    }
  }

  return Math.max(0, unshared - shared)
}

// Clusters methods that (transitively) share instance variables. More than one cluster
// means the class mixes unrelated responsibilities and is a candidate for splitting.
export const getCohesionGroups = (classDeclaration: ClassDeclaration): { methods: string[]; variables: string[] }[] => {
  const usages = getMethodUsages(classDeclaration).filter((usage) => usage.variables.size > 0)
  if (usages.length < 2) return []

  const parent = usages.map((_, index) => index)
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]]
      index = parent[index]
    }
    return index
  }
  const union = (a: number, b: number): void => {
    parent[find(a)] = find(b)
  }

  const firstUserOf = new Map<string, number>()
  usages.forEach((usage, index) => {
    for (const variable of usage.variables) {
      if (firstUserOf.has(variable)) {
        union(index, firstUserOf.get(variable)!)
        continue
      }
      firstUserOf.set(variable, index)
    }
  })

  const groups = new Map<number, { methods: string[]; variables: Set<string> }>()
  usages.forEach((usage, index) => {
    const root = find(index)
    if (!groups.has(root)) groups.set(root, { methods: [], variables: new Set() })
    const group = groups.get(root)!
    group.methods.push(usage.name)
    for (const variable of usage.variables) group.variables.add(variable)
  })

  return [...groups.values()].map((group) => ({ methods: group.methods, variables: [...group.variables] }))
}

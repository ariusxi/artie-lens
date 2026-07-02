import { CallExpression, ClassDeclaration, Node, SyntaxKind, Type } from 'ts-morph'

const isExternalDeclaration = (declaration: Node): boolean => {
  const sourceFile = declaration.getSourceFile()
  return sourceFile.isInNodeModules() || sourceFile.isDeclarationFile()
}

const addCoupledClass = (declaration: Node | undefined, self: ClassDeclaration, coupled: Set<ClassDeclaration>): void => {
  if (!declaration || !Node.isClassDeclaration(declaration)) return
  if (declaration === self || isExternalDeclaration(declaration)) return

  coupled.add(declaration)
}

const addCoupledFromType = (type: Type, self: ClassDeclaration, coupled: Set<ClassDeclaration>, seen = new Set<Type>()): void => {
  if (seen.has(type)) return
  seen.add(type)

  if (type.isUnionOrIntersection()) {
    for (const inner of type.getUnionTypes().concat(type.getIntersectionTypes())) {
      addCoupledFromType(inner, self, coupled, seen)
    }
    return
  }

  const declaration = (type.getSymbol() ?? type.getAliasSymbol())?.getDeclarations()[0]
  addCoupledClass(declaration, self, coupled)

  for (const argument of type.getTypeArguments()) {
    addCoupledFromType(argument, self, coupled, seen)
  }
}

const addCoupledFromUsage = (node: Node, self: ClassDeclaration, coupled: Set<ClassDeclaration>): void => {
  const declaration = node.getSymbol()?.getDeclarations()[0]
  if (!declaration) return

  const owner = declaration.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)
  addCoupledClass(owner ?? declaration, self, coupled)
}

export const getCoupledClasses = (classDeclaration: ClassDeclaration): Set<ClassDeclaration> => {
  const coupled = new Set<ClassDeclaration>()

  // Heritage coupling (extends / implements); interfaces resolve to non-class declarations and are ignored
  for (const clause of classDeclaration.getHeritageClauses()) {
    for (const typeNode of clause.getTypeNodes()) {
      addCoupledFromType(typeNode.getType(), classDeclaration, coupled)
    }
  }

  // Signature coupling: parameter and return types of constructors, methods and accessors, plus property types
  for (const constructor of classDeclaration.getConstructors()) {
    for (const parameter of constructor.getParameters()) {
      addCoupledFromType(parameter.getType(), classDeclaration, coupled)
    }
  }

  const returnables = [
    ...classDeclaration.getMethods(),
    ...classDeclaration.getGetAccessors(),
    ...classDeclaration.getSetAccessors(),
  ]
  for (const signature of returnables) {
    for (const parameter of signature.getParameters()) {
      addCoupledFromType(parameter.getType(), classDeclaration, coupled)
    }
    addCoupledFromType(signature.getReturnType(), classDeclaration, coupled)
  }

  for (const property of classDeclaration.getProperties()) {
    addCoupledFromType(property.getType(), classDeclaration, coupled)
  }

  // Behavioral coupling: instantiations, method calls and property accesses on other classes
  for (const created of classDeclaration.getDescendantsOfKind(SyntaxKind.NewExpression)) {
    addCoupledFromType(created.getType(), classDeclaration, coupled)
  }
  for (const call of classDeclaration.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    addCoupledFromUsage(call.getExpression(), classDeclaration, coupled)
  }
  for (const access of classDeclaration.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    addCoupledFromUsage(access, classDeclaration, coupled)
  }

  return coupled
}

const isFunctionInitializer = (node: Node | undefined): boolean =>
  !!node && (Node.isArrowFunction(node) || Node.isFunctionExpression(node))

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

interface MethodUsage {
  name: string
  variables: Set<string>
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

const DECISION_KINDS = [
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.CatchClause,
]

const LOGICAL_OPERATORS = [
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.QuestionQuestionToken,
]

const getMethodComplexity = (method: Node): number => {
  let complexity = 1

  for (const kind of DECISION_KINDS) {
    complexity += method.getDescendantsOfKind(kind).length
  }

  for (const binary of method.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const operator = binary.getOperatorToken().getKind()
    if (LOGICAL_OPERATORS.includes(operator)) complexity += 1
  }

  return complexity
}

export const getWeightedMethods = (classDeclaration: ClassDeclaration): number => {
  const methods: Node[] = [
    ...classDeclaration.getConstructors(),
    ...classDeclaration.getMethods().filter((method) => !method.isOverload()),
    ...classDeclaration.getGetAccessors(),
    ...classDeclaration.getSetAccessors(),
  ]

  for (const property of classDeclaration.getProperties()) {
    if (property.isStatic() || !isFunctionInitializer(property.getInitializer())) continue
    methods.push(property.getInitializerOrThrow())
  }

  return methods.reduce((total, method) => total + getMethodComplexity(method), 0)
}

export const getDepthOfInheritance = (classDeclaration: ClassDeclaration): number => {
  let depth = 0
  let current = classDeclaration.getBaseClass()

  while (current) {
    depth += 1
    current = current.getBaseClass()
  }

  return depth
}

export const getNumberOfChildren = (classDeclaration: ClassDeclaration): number =>
  // getDerivedClasses() returns all descendants; keep only immediate children
  classDeclaration
    .getDerivedClasses()
    .filter((derived) => derived.getBaseClass() === classDeclaration)
    .length

const getOwnMemberKey = (name: string, kindName: string): string => `own:${kindName}:${name}`

const getCallResponseKey = (call: CallExpression, classDeclaration: ClassDeclaration): string | undefined => {
  const expression = call.getExpression()
  const declaration = expression.getSymbol()?.getDeclarations()[0]

  if (!declaration) return expression.getText()

  const sourceFile = declaration.getSourceFile()
  // Following the CK paper (footnote 27), calls to library functions are not part of the response set
  if (sourceFile.isInNodeModules() || sourceFile.isDeclarationFile()) return undefined

  const parentClass = declaration.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)
  if (parentClass === classDeclaration && Node.hasName(declaration)) {
    return getOwnMemberKey(declaration.getName(), declaration.getKindName())
  }

  return `${sourceFile.getFilePath()}:${declaration.getStart()}`
}

export const getResponseSetLength = (classDeclaration: ClassDeclaration): number => {
  const responseSet = new Set<string>()
  const bodies: Node[] = [...classDeclaration.getConstructors()]

  const declaredMethods = [
    ...classDeclaration.getMethods().filter((method) => !method.isOverload()),
    ...classDeclaration.getGetAccessors(),
    ...classDeclaration.getSetAccessors(),
  ]

  for (const method of declaredMethods) {
    responseSet.add(getOwnMemberKey(method.getName(), method.getKindName()))
    bodies.push(method)
  }

  for (const property of classDeclaration.getProperties()) {
    const initializer = property.getInitializer()
    if (!isFunctionInitializer(initializer)) continue
    responseSet.add(getOwnMemberKey(property.getName(), property.getKindName()))
    bodies.push(property.getInitializerOrThrow())
  }

  for (const body of bodies) {
    for (const call of body.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const key = getCallResponseKey(call, classDeclaration)
      if (key) responseSet.add(key)
    }
  }

  return responseSet.size
}

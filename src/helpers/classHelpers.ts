import { CallExpression, ClassDeclaration, Node, SyntaxKind, Type } from 'ts-morph'
import { IMetricsModel } from 'tsmetrics-core'

function isExternalDeclaration(declaration: Node): boolean {
  const sourceFile = declaration.getSourceFile()
  return sourceFile.isInNodeModules() || sourceFile.isDeclarationFile()
}

function addCoupledClass(declaration: Node | undefined, self: ClassDeclaration, coupled: Set<ClassDeclaration>): void {
  if (!declaration || !Node.isClassDeclaration(declaration)) return
  if (declaration === self || isExternalDeclaration(declaration)) return

  coupled.add(declaration)
}

function addCoupledFromType(type: Type, self: ClassDeclaration, coupled: Set<ClassDeclaration>, seen = new Set<Type>()): void {
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

function addCoupledFromUsage(node: Node, self: ClassDeclaration, coupled: Set<ClassDeclaration>): void {
  const declaration = node.getSymbol()?.getDeclarations()[0]
  if (!declaration) return

  const owner = declaration.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)
  addCoupledClass(owner ?? declaration, self, coupled)
}

export function getCoupledClasses(classDeclaration: ClassDeclaration): Set<ClassDeclaration> {
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

function isFunctionInitializer(node: Node | undefined): boolean {
  return !!node && (Node.isArrowFunction(node) || Node.isFunctionExpression(node))
}

function getInstanceVariableNames(classDeclaration: ClassDeclaration): Set<string> {
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

function getCohesionMethods(classDeclaration: ClassDeclaration): Node[] {
  const methods: Node[] = []

  for (const method of classDeclaration.getMethods()) {
    if (!method.isStatic() && !method.isOverload()) methods.push(method)
  }
  for (const accessor of [...classDeclaration.getGetAccessors(), ...classDeclaration.getSetAccessors()]) {
    if (!accessor.isStatic()) methods.push(accessor)
  }
  for (const property of classDeclaration.getProperties()) {
    if (!property.isStatic() && isFunctionInitializer(property.getInitializer())) {
      methods.push(property.getInitializerOrThrow())
    }
  }

  return methods
}

function getUsedInstanceVariables(method: Node, instanceVariables: Set<string>): Set<string> {
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

export function getCohesionLength(classDeclaration: ClassDeclaration): number {
  const methods = getCohesionMethods(classDeclaration)
  if (methods.length < 2) return 0

  const instanceVariables = getInstanceVariableNames(classDeclaration)
  const usedPerMethod = methods.map((method) => getUsedInstanceVariables(method, instanceVariables))

  // CK paper: if no method uses any instance variable, LCOM is 0
  if (usedPerMethod.every((used) => used.size === 0)) return 0

  let shared = 0
  let unshared = 0

  for (let i = 0; i < usedPerMethod.length; i++) {
    for (let j = i + 1; j < usedPerMethod.length; j++) {
      const intersects = [...usedPerMethod[i]].some((name) => usedPerMethod[j].has(name))
      if (intersects) shared++
      else unshared++
    }
  }

  return Math.max(0, unshared - shared)
}

export function getComplexityLength(metrics: IMetricsModel[]): number {
  const total = metrics.reduce((accum, metric) => {
    if (metric.children.length === 0) {
      return accum + metric.complexity
    }

    const value = getComplexityLength(metric.children)
    return accum + value + metric.complexity
  }, 0)

  return total
}

function getOwnMemberKey(name: string, kindName: string): string {
  return `own:${kindName}:${name}`
}

function getCallResponseKey(call: CallExpression, classDeclaration: ClassDeclaration): string | undefined {
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

export function getResponseSetLength(classDeclaration: ClassDeclaration): number {
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
    if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
      responseSet.add(getOwnMemberKey(property.getName(), property.getKindName()))
      bodies.push(initializer)
    }
  }

  for (const body of bodies) {
    for (const call of body.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const key = getCallResponseKey(call, classDeclaration)
      if (key) responseSet.add(key)
    }
  }

  return responseSet.size
}
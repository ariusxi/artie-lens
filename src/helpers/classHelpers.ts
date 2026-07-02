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

export function getCohesionLength(classDeclaration: ClassDeclaration): number {
  const methods = classDeclaration.getMethods()
  const properties = classDeclaration
    .getProperties()
    .map((property) => property.getName())

  if (methods.length < 2) return 0

  const methodProperties = methods.map((method) => {
    const body = method.getBodyText() ?? ''
    return properties.filter((property) => body.includes(`this.${property}`))
  })

  let shared = 0
  let unshared = 0

  for (let i = 0; i < methodProperties.length; i++) {
    for (let j = i + 1; j < methodProperties.length; j++) {
      const intersection = methodProperties[i].filter((property) => methodProperties[j].includes(property))
      if (intersection.length > 0) shared++
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
import { ClassDeclaration, Node, SyntaxKind, Type } from 'ts-morph'

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

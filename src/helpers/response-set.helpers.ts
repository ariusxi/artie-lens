import { CallExpression, ClassDeclaration, Node, SyntaxKind } from 'ts-morph'

import { isFunctionInitializer } from './ast.helpers'

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

import { CallExpression, ClassDeclaration, Node, SyntaxKind } from 'ts-morph'
import { IMetricsModel } from 'tsmetrics-core'
import { createProgram, forEachChild, isClassDeclaration, isConstructorDeclaration, isPropertyDeclaration, Program, SourceFile, Symbol, TypeChecker } from 'typescript'

import { getCompilerOptions, getSourceFileByPath } from './fileHelpers'

export function addClassDependencyFromSymbol(symbol: Symbol, dependencies: Set<string>): void {
  const name = symbol.getName()
  const declarations = symbol.getDeclarations()

  if (!declarations && !dependencies.has(name)) {
    dependencies.add(name)
    return
  }

  for (const declaration of declarations!) {
    if (isClassDeclaration(declaration) && declaration.name) {
      const className = declaration.name.text
      dependencies.add(className)
      return
    }
  }
}

export function addClassDependencies(property: any, typeChecker: TypeChecker, dependencies: Set<string>): void {
  const type = typeChecker.getTypeAtLocation(property)
  const symbol = type.getSymbol()
  if (symbol) addClassDependencyFromSymbol(symbol, dependencies)
}

export function collectClassDependencies(sourceFile: SourceFile, typeChecker: TypeChecker): Set<string> {
  const dependencies = new Set<string>()

  forEachChild(sourceFile, (node) => {
    if (isClassDeclaration(node) && node.name) {
      node.members.forEach((member) => {
        if (isConstructorDeclaration(member)) {
          member.parameters.forEach((parameter) => 
            addClassDependencies(parameter, typeChecker, dependencies)
          )
        }

        if (isPropertyDeclaration(member) && member.initializer) {
          addClassDependencies(member.initializer, typeChecker, dependencies)
        }

        if (node.heritageClauses) {
          node.heritageClauses.forEach((clause) => {
            clause.types.forEach((type) => addClassDependencies(type, typeChecker, dependencies))
          })
        }
      })
    }
  })

  return dependencies
}

export function getClassDependenciesLength(filePath: string, program: Program): number {
  const sourceFile = getSourceFileByPath(filePath, program)
  if (!sourceFile) return 0
  
  const typeChecker = program.getTypeChecker()
  const dependencies = collectClassDependencies(sourceFile, typeChecker)

  return dependencies.size
}


export function createProjectProgram(configPath: string, files: string[]): Program {
  const options = getCompilerOptions(configPath)
  const program = createProgram(files, options)
  if (!program) {
    throw new Error('Failed to create project program')
  }

  return program
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
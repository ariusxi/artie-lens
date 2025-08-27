import { ClassDeclaration } from 'ts-morph'
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

export function getFunctionsLength(fileContent: string): number {
  const regex = /\bfunction\b|\bclass\b.*\b\w+\s*\(/g
  const matches = fileContent.match(regex)

  return matches ? matches.length : 0
}
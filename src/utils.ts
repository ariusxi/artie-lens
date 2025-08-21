import fg from 'fast-glob'
import { resolve, join } from 'path'
import { red, yellow, green } from 'colorette'
import { readdirSync, readFileSync } from 'fs'
import { ClassDeclaration, Project } from 'ts-morph'
import { CompilerOptions, createProgram, Symbol, forEachChild, isClassDeclaration, isConstructorDeclaration, parseJsonConfigFileContent, Program, readConfigFile, SourceFile, sys, TypeChecker, isPropertyDeclaration } from 'typescript'

import { MetricConfig, MetricResult } from './types/config.interface'

export async function getSourceFiles(directory: string, include: string[], exclude: string[]): Promise<string[]> {
  return await fg(include, {
    cwd: directory,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: exclude,
  })
}

export function readFileContent(directory: string): string {
  return readFileSync(directory, 'utf-8')
}

export function printMetric(value: string, label: string): void {
  const colorFn = {
    'OK': green,
    'WARNING': yellow,
    'CRITICAL': red
  }

  const color = colorFn[label]

  console.log(color(value))
} 

export function getProjectConfigPath(directory: string): string {
  const configFile = readdirSync(directory).find((file: string) => {
    return file.startsWith('tsconfig') && file.endsWith('.json')
  })

  if (!configFile) {
    throw new Error('⚠️ tsconfig.json not found.')
  }

  return join(directory, configFile)
}

export function getCompilerOptions(configPath: string): CompilerOptions {
  const configFile = readConfigFile(configPath, sys.readFile)
  if (configFile.error) {
    throw new Error(`Failed to read tsconfig.json: ${configFile.error.messageText}`)
  }

  const projectConfig = parseJsonConfigFileContent(configFile.config, sys, resolve(configPath))
  return projectConfig.options
}

export function getSourceFileByPath(filePath: string, program: Program): SourceFile | void {
  return program.getSourceFiles().find((file) => file.fileName === filePath)
}

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

export function getMetricLabel(total: number, metricConfig: MetricConfig): string {
  if (total >= metricConfig.critical!) return 'CRITICAL'
  if (total >= metricConfig.warning!) return 'WARNING'

  return 'OK'
}

export function getClassDependenciesLength(filePath: string, program: Program): number {
  const sourceFile = getSourceFileByPath(filePath, program)
  if (!sourceFile) return 0
  
  const typeChecker = program.getTypeChecker()
  const dependencies = collectClassDependencies(sourceFile, typeChecker)

  return dependencies.size
}

export function getFunctionsLength(fileContent: string): number {
  const regex = /\bfunction\b|\bclass\b.*\b\w+\s*\(/g
  const matches = fileContent.match(regex)

  return matches ? matches.length : 0
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

export function createProjectProgram(configPath: string, files: string[]): Program {
  const options = getCompilerOptions(configPath)
  const program = createProgram(files, options)
  if (!program) {
    throw new Error('Failed to create project program')
  }

  return program
}

export async function calculateCBO(directory: string, metricConfig: MetricConfig, include: string[], exclude: string[]): Promise<MetricResult[]> {
  const configPath = getProjectConfigPath(directory)
  const files = await getSourceFiles(directory, include, exclude)

  const program = createProjectProgram(configPath, files)
  const items = files
    .map((file) => {
      const total = getClassDependenciesLength(file, program)
      const label = getMetricLabel(total, metricConfig)

      return { total, label, value: file }
    })

  return items
}

export async function calculateRFC(directory: string, metricConfig: MetricConfig, include: string[], exclude: string[]): Promise<MetricResult[]> {
  const files = await getSourceFiles(directory, include, exclude)
  
  const items = files
    .map((file) => {
      const content = readFileContent(file)
      const total = getFunctionsLength(content)
      const label = getMetricLabel(total, metricConfig)

      return { total, label, value: file }
    })

  return items
}

export async function calculateLCOM(directory: string, metricConfig: MetricConfig, include: string[], exclude: string[]): Promise<MetricResult[]> {
  const files = await getSourceFiles(directory, include, exclude)
  const project = new Project()

  project.addSourceFilesAtPaths(files)

  const items = []
  for (const sourceFile of project.getSourceFiles()) {
    for (const classDeclaration of sourceFile.getClasses()) {
      const className = classDeclaration.getName() ?? '[UnnamedClass]'
      const total = getCohesionLength(classDeclaration)
      const label = getMetricLabel(total, metricConfig)

      items.push({ total, label, value: className })
    }
  }

  return items
}
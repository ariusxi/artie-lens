import { Project } from 'ts-morph'
import { MetricsConfiguration, MetricsParser } from 'tsmetrics-core'

import { MetricConfig, MetricResult } from '../types/config.interface'
import { getProjectConfigPath, getProjectTarget, getSourceFiles, readFileContent } from './fileHelpers'
import { createProjectProgram, getClassDependenciesLength, getCohesionLength, getComplexityLength, getFunctionsLength } from './classHelpers'

export function getMetricLabel(total: number, metricConfig: MetricConfig): string {
  if (total >= metricConfig.critical!) return 'CRITICAL'
  if (total >= metricConfig.warning!) return 'WARNING'

  return 'OK'
}

export const metricInsights: Record<string, Record<string, string>> = {
  lcom: {
    OK: "Cohesion is healthy. Classes are focused.",
    WARNING: "Cohesion is getting weaker → the class may be mixing multiple responsibilities.",
    CRITICAL: "Very low cohesion → the class is handling too many concerns. Suggestion: split into smaller classes (SRP)."
  },
  wmc: {
    OK: "Complexity is under control.",
    WARNING: "Complexity is increasing → consider extracting helper methods or simplifying logic.",
    CRITICAL: "High complexity → difficult to test and maintain. Suggestion: refactor into smaller methods or delegate responsibilities to services."
  },
  cbo: {
    OK: "Coupling level is acceptable.",
    WARNING: "Coupling is getting higher → class depends on many others.",
    CRITICAL: "High coupling → changes in other classes may easily break this one. Suggestion: apply Dependency Inversion or create interfaces."
  },
  rfc: {
    OK: "Response set is small and manageable.",
    WARNING: "Class exposes too many methods → consider reducing its interface.",
    CRITICAL: "Very high number of accessible methods → too many responsibilities. Suggestion: encapsulate better and remove unnecessary methods."
  }
}

export async function calculateCBO(directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]): Promise<MetricResult[]> {
  const configPath = getProjectConfigPath(directory)
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const program = createProjectProgram(configPath, files)
  const items = files
    .map((file) => {
      const total = getClassDependenciesLength(file, program)
      const label = getMetricLabel(total, metricConfig)

      return { total, label, value: file }
    })

  return items
}

export async function calculateRFC(directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]): Promise<MetricResult[]> {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []
  
  const items = files
    .map((file) => {
      const content = readFileContent(file)
      const total = getFunctionsLength(content)
      const label = getMetricLabel(total, metricConfig)

      return { total, label, value: file }
    })

  return items
}

export async function calculateLCOM(directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]): Promise<MetricResult[]> {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

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

export async function calculateWMC(directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]): Promise<MetricResult[]> {
  const configPath = getProjectConfigPath(directory)
  const configContent = readFileContent(configPath)

  const target = getProjectTarget(configContent)
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const items = files.map((file) => {
    const { metrics } = MetricsParser.getMetrics(file, MetricsConfiguration, target)
    const total = getComplexityLength([metrics])
    const label = getMetricLabel(total, metricConfig)

    return { total, label, value: file }
  })

  return items
}
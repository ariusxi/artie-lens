import { Project } from 'ts-morph'

import { MetricConfig, MetricResult } from '../types/config.interface'
import { getSourceFiles } from './fileHelpers'
import { getCohesionLength, getCoupledClasses, getDepthOfInheritance, getNumberOfChildren, getResponseSetLength, getWeightedMethods } from './classHelpers'

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
    WARNING: "Growing response set → the class can trigger many methods, making testing and debugging harder.",
    CRITICAL: "Very large response set → too many methods can execute in response to a message. Suggestion: split responsibilities and reduce calls to other classes."
  },
  dit: {
    OK: "Inheritance depth is shallow and easy to follow.",
    WARNING: "Class sits deep in the hierarchy → behavior is harder to predict due to many inherited methods.",
    CRITICAL: "Very deep inheritance → hard to understand and test. Suggestion: favor composition over inheritance."
  },
  noc: {
    OK: "Number of direct subclasses is reasonable.",
    WARNING: "Many direct subclasses → make sure the base abstraction is right and thoroughly tested.",
    CRITICAL: "Very high number of children → possible misuse of subclassing or a leaky abstraction. Suggestion: reconsider the hierarchy."
  }
}

export async function calculateCBO(directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]): Promise<MetricResult[]> {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const project = new Project()
  project.addSourceFilesAtPaths(files)

  const items = []
  for (const sourceFile of project.getSourceFiles()) {
    for (const classDeclaration of sourceFile.getClasses()) {
      const className = classDeclaration.getName() ?? '[UnnamedClass]'
      const total = getCoupledClasses(classDeclaration).size
      const label = getMetricLabel(total, metricConfig)

      items.push({ total, label, value: className })
    }
  }

  return items
}

export async function calculateRFC(directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]): Promise<MetricResult[]> {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const project = new Project()
  project.addSourceFilesAtPaths(files)

  const items = []
  for (const sourceFile of project.getSourceFiles()) {
    for (const classDeclaration of sourceFile.getClasses()) {
      const className = classDeclaration.getName() ?? '[UnnamedClass]'
      const total = getResponseSetLength(classDeclaration)
      const label = getMetricLabel(total, metricConfig)

      items.push({ total, label, value: className })
    }
  }

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
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const project = new Project()
  project.addSourceFilesAtPaths(files)

  const items = []
  for (const sourceFile of project.getSourceFiles()) {
    for (const classDeclaration of sourceFile.getClasses()) {
      const className = classDeclaration.getName() ?? '[UnnamedClass]'
      const total = getWeightedMethods(classDeclaration)
      const label = getMetricLabel(total, metricConfig)

      items.push({ total, label, value: className })
    }
  }

  return items
}

export async function calculateDIT(directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]): Promise<MetricResult[]> {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const project = new Project()
  project.addSourceFilesAtPaths(files)

  const items = []
  for (const sourceFile of project.getSourceFiles()) {
    for (const classDeclaration of sourceFile.getClasses()) {
      const className = classDeclaration.getName() ?? '[UnnamedClass]'
      const total = getDepthOfInheritance(classDeclaration)
      const label = getMetricLabel(total, metricConfig)

      items.push({ total, label, value: className })
    }
  }

  return items
}

export async function calculateNOC(directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]): Promise<MetricResult[]> {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const project = new Project()
  project.addSourceFilesAtPaths(files)

  const items = []
  for (const sourceFile of project.getSourceFiles()) {
    for (const classDeclaration of sourceFile.getClasses()) {
      const className = classDeclaration.getName() ?? '[UnnamedClass]'
      const total = getNumberOfChildren(classDeclaration)
      const label = getMetricLabel(total, metricConfig)

      items.push({ total, label, value: className })
    }
  }

  return items
}
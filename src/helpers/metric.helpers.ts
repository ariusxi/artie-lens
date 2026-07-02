import { relative } from 'path'
import { ClassDeclaration } from 'ts-morph'

import { MetricConfig, MetricResult } from '../types/config.interface'

import { getSourceFiles } from './file.helpers'
import { createAnalysisProject } from './project.helpers'
import { getCohesionLength, getCoupledClasses, getDepthOfInheritance, getNumberOfChildren, getResponseSetLength, getWeightedMethods } from './class.helpers'
import { buildModuleGraph, findCycleSizes } from './module.helpers'

const UNNAMED_CLASS = '[UnnamedClass]'

export const getMetricLabel = (total: number, metricConfig: MetricConfig): string => {
  if (total >= metricConfig.critical!) return 'CRITICAL'
  if (total >= metricConfig.warning!) return 'WARNING'

  return 'OK'
}

const SEVERITY_RANK: Record<string, number> = { OK: 1, WARNING: 2, CRITICAL: 3 }

export const severityRank = (label: string): number => SEVERITY_RANK[label?.toUpperCase()] ?? 0

export const metricInsights: Record<string, Record<string, string>> = {
  lcom: {
    OK: 'Cohesion is healthy. Classes are focused.',
    WARNING: 'Cohesion is getting weaker → the class may be mixing multiple responsibilities.',
    CRITICAL: 'Very low cohesion → the class is handling too many concerns. Suggestion: split into smaller classes (SRP).',
  },
  wmc: {
    OK: 'Complexity is under control.',
    WARNING: 'Complexity is increasing → consider extracting helper methods or simplifying logic.',
    CRITICAL: 'High complexity → difficult to test and maintain. Suggestion: refactor into smaller methods or delegate responsibilities to services.',
  },
  cbo: {
    OK: 'Coupling level is acceptable.',
    WARNING: 'Coupling is getting higher → class depends on many others.',
    CRITICAL: 'High coupling → changes in other classes may easily break this one. Suggestion: apply Dependency Inversion or create interfaces.',
  },
  rfc: {
    OK: 'Response set is small and manageable.',
    WARNING: 'Growing response set → the class can trigger many methods, making testing and debugging harder.',
    CRITICAL: 'Very large response set → too many methods can execute in response to a message. Suggestion: split responsibilities and reduce calls to other classes.',
  },
  dit: {
    OK: 'Inheritance depth is shallow and easy to follow.',
    WARNING: 'Class sits deep in the hierarchy → behavior is harder to predict due to many inherited methods.',
    CRITICAL: 'Very deep inheritance → hard to understand and test. Suggestion: favor composition over inheritance.',
  },
  noc: {
    OK: 'Number of direct subclasses is reasonable.',
    WARNING: 'Many direct subclasses → make sure the base abstraction is right and thoroughly tested.',
    CRITICAL: 'Very high number of children → possible misuse of subclassing or a leaky abstraction. Suggestion: reconsider the hierarchy.',
  },
  ce: {
    OK: 'This module depends on few others.',
    WARNING: 'This module imports many others → it is fragile to upstream changes.',
    CRITICAL: 'This module is a coupling hub → changes ripple widely. Suggestion: extract stable abstractions or split it.',
  },
  cyclic: {
    OK: 'No circular dependency.',
    WARNING: 'This module is part of an import cycle → harder to test and build.',
    CRITICAL: 'This module is part of an import cycle → hard to test, build, and reason about. Suggestion: break the cycle with an interface or a shared module.',
  },
}

type MetricCalculator = (directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]) => Promise<MetricResult[]>

type ClassMetric = (classDeclaration: ClassDeclaration) => number

type ModuleTotals = (graph: Map<string, Set<string>>) => Map<string, number>

const calculateClassMetric = (metric: ClassMetric): MetricCalculator => async (directory, metricConfig, includes, excludes) => {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const { sourceFiles } = createAnalysisProject(directory, files)
  const items: MetricResult[] = []

  for (const sourceFile of sourceFiles) {
    for (const classDeclaration of sourceFile.getClasses()) {
      const value = classDeclaration.getName() ?? UNNAMED_CLASS
      const total = metric(classDeclaration)

      items.push({ total, label: getMetricLabel(total, metricConfig), value })
    }
  }

  return items
}

const calculateModuleMetric = (totalsOf: ModuleTotals): MetricCalculator => async (directory, metricConfig, includes, excludes) => {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const { project, sourceFiles } = createAnalysisProject(directory, files)
  const includedPaths = new Set(sourceFiles.map((sourceFile) => sourceFile.getFilePath()))
  const graph = buildModuleGraph(project, includedPaths)
  const totals = totalsOf(graph)
  const items: MetricResult[] = []

  for (const path of graph.keys()) {
    const total = totals.get(path) ?? 0

    items.push({ total, label: getMetricLabel(total, metricConfig), value: relative(directory, path) })
  }

  return items
}

const efferentCoupling: ModuleTotals = (graph) => new Map([...graph].map(([path, dependencies]) => [path, dependencies.size]))

export const calculateCBO = calculateClassMetric((classDeclaration) => getCoupledClasses(classDeclaration).size)
export const calculateRFC = calculateClassMetric(getResponseSetLength)
export const calculateLCOM = calculateClassMetric(getCohesionLength)
export const calculateWMC = calculateClassMetric(getWeightedMethods)
export const calculateDIT = calculateClassMetric(getDepthOfInheritance)
export const calculateNOC = calculateClassMetric(getNumberOfChildren)

export const calculateCE = calculateModuleMetric(efferentCoupling)
export const calculateCyclic = calculateModuleMetric(findCycleSizes)

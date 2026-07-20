import { relative } from 'path'
import { ClassDeclaration, SourceFile } from 'ts-morph'

import { MetricConfig, MetricResult } from '../types/config.interface'

import { getSourceFiles } from './file.helpers'
import { createAnalysisProject } from './project.helpers'
import { getCohesionLength, getCoupledClasses, getDepthOfInheritance, getNumberOfChildren, getResponseSetLength, getWeightedMethods } from './class.helpers'
import { buildModuleGraph, findCycleSizes } from './module.helpers'
import { computeMartin } from './martin.helpers'

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
  distance: {
    OK: 'Balanced: abstraction matches how much the module is depended on.',
    WARNING: 'Drifting from the main sequence → either too abstract and unused, or too concrete and depended on.',
    CRITICAL: 'Far from the main sequence → a concrete, widely-used module (hard to change) or an abstract, unused one (dead weight).',
  },
}

// Built once per run and shared across every metric, so the project is parsed a single
// time instead of once per metric.
export interface AnalysisContext {
  directory: string
  sourceFiles: SourceFile[]
  graph: Map<string, Set<string>>
}

export const buildAnalysisContext = async (directory: string, includes: string[], excludes: string[], ignoreReExports = false): Promise<AnalysisContext | null> => {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return null

  const { project, sourceFiles } = createAnalysisProject(directory, files)
  const includedPaths = new Set(sourceFiles.map((sourceFile) => sourceFile.getFilePath()))
  const graph = buildModuleGraph(project, includedPaths, ignoreReExports)

  return { directory, sourceFiles, graph }
}

type ClassMetric = (classDeclaration: ClassDeclaration) => number

type ModuleTotals = (graph: Map<string, Set<string>>) => Map<string, number>

type ContextMetric = (context: AnalysisContext, metricConfig: MetricConfig) => MetricResult[]

const classResults = (context: AnalysisContext, metric: ClassMetric, metricConfig: MetricConfig): MetricResult[] => {
  const items: MetricResult[] = []

  for (const sourceFile of context.sourceFiles) {
    const file = relative(context.directory, sourceFile.getFilePath())

    for (const classDeclaration of sourceFile.getClasses()) {
      const value = classDeclaration.getName() ?? UNNAMED_CLASS
      const total = metric(classDeclaration)

      items.push({ total, label: getMetricLabel(total, metricConfig), value, file })
    }
  }

  return items
}

const moduleResults = (context: AnalysisContext, totalsOf: ModuleTotals, metricConfig: MetricConfig): MetricResult[] => {
  const totals = totalsOf(context.graph)
  const items: MetricResult[] = []

  for (const path of context.graph.keys()) {
    const total = totals.get(path) ?? 0
    const file = relative(context.directory, path)

    items.push({ total, label: getMetricLabel(total, metricConfig), value: file, file })
  }

  return items
}

const efferentCoupling: ModuleTotals = (graph) => new Map([...graph].map(([path, dependencies]) => [path, dependencies.size]))

const classMetric = (metric: ClassMetric): ContextMetric => (context, metricConfig) => classResults(context, metric, metricConfig)

const moduleMetric = (totalsOf: ModuleTotals): ContextMetric => (context, metricConfig) => moduleResults(context, totalsOf, metricConfig)

export const metricRegistry: Record<string, ContextMetric> = {
  cbo: classMetric((classDeclaration) => getCoupledClasses(classDeclaration).size),
  rfc: classMetric(getResponseSetLength),
  lcom: classMetric(getCohesionLength),
  wmc: classMetric(getWeightedMethods),
  dit: classMetric(getDepthOfInheritance),
  noc: classMetric(getNumberOfChildren),
  ce: moduleMetric(efferentCoupling),
  cyclic: moduleMetric(findCycleSizes),
  distance: (context, metricConfig) => {
    const martin = computeMartin(context.graph, context.sourceFiles)
    const items: MetricResult[] = []

    for (const [path, metrics] of martin) {
      const total = Math.round(metrics.distance * 100)
      const value = relative(context.directory, path)
      items.push({ total, label: getMetricLabel(total, metricConfig), value, file: value })
    }

    return items
  },
}

type MetricCalculator = (directory: string, metricConfig: MetricConfig, includes: string[], excludes: string[]) => Promise<MetricResult[]>

const asCalculator = (metric: ContextMetric): MetricCalculator => async (directory, metricConfig, includes, excludes) => {
  const context = await buildAnalysisContext(directory, includes, excludes)
  if (!context) return []

  return metric(context, metricConfig)
}

export const calculateCBO = asCalculator(metricRegistry.cbo)
export const calculateRFC = asCalculator(metricRegistry.rfc)
export const calculateLCOM = asCalculator(metricRegistry.lcom)
export const calculateWMC = asCalculator(metricRegistry.wmc)
export const calculateDIT = asCalculator(metricRegistry.dit)
export const calculateNOC = asCalculator(metricRegistry.noc)
export const calculateCE = asCalculator(metricRegistry.ce)
export const calculateCyclic = asCalculator(metricRegistry.cyclic)

import { relative } from 'path'

import { AnalysisContext, buildAnalysisContext } from './metric.helpers'
import { getCohesionGroups } from './class.helpers'
import { findCycleGroups, findCyclePath } from './module.helpers'

export interface CycleSuggestion {
  size: number
  path: string[]
}

export interface CohesionSuggestion {
  value: string
  groups: { methods: string[]; variables: string[] }[]
}

export const cyclesFromContext = (context: AnalysisContext): CycleSuggestion[] =>
  findCycleGroups(context.graph).map((group) => ({
    size: group.length,
    path: findCyclePath(context.graph, group).map((path) => relative(context.directory, path)),
  }))

export const cohesionFromContext = (context: AnalysisContext): CohesionSuggestion[] => {
  const suggestions: CohesionSuggestion[] = []

  for (const sourceFile of context.sourceFiles) {
    for (const classDeclaration of sourceFile.getClasses()) {
      const groups = getCohesionGroups(classDeclaration)
      if (groups.length <= 1) continue

      suggestions.push({ value: classDeclaration.getName() ?? '[UnnamedClass]', groups })
    }
  }

  return suggestions
}

export const suggestCycles = async (directory: string, includes: string[], excludes: string[], ignoreReExports = false): Promise<CycleSuggestion[]> => {
  const context = await buildAnalysisContext(directory, includes, excludes, ignoreReExports)
  return context ? cyclesFromContext(context) : []
}

export const suggestCohesion = async (directory: string, includes: string[], excludes: string[]): Promise<CohesionSuggestion[]> => {
  const context = await buildAnalysisContext(directory, includes, excludes)
  return context ? cohesionFromContext(context) : []
}

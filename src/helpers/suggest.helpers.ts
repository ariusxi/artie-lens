import { relative } from 'path'

import { getSourceFiles } from './file.helpers'
import { createAnalysisProject } from './project.helpers'
import { getCohesionGroups } from './class.helpers'
import { buildModuleGraph, findCycleGroups } from './module.helpers'

export interface CycleSuggestion {
  modules: string[]
}

export interface CohesionSuggestion {
  value: string
  groups: { methods: string[]; variables: string[] }[]
}

export const suggestCycles = async (directory: string, includes: string[], excludes: string[]): Promise<CycleSuggestion[]> => {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const { project, sourceFiles } = createAnalysisProject(directory, files)
  const includedPaths = new Set(sourceFiles.map((sourceFile) => sourceFile.getFilePath()))
  const graph = buildModuleGraph(project, includedPaths)

  return findCycleGroups(graph).map((group) => ({
    modules: group.map((path) => relative(directory, path)),
  }))
}

export const suggestCohesion = async (directory: string, includes: string[], excludes: string[]): Promise<CohesionSuggestion[]> => {
  const files = await getSourceFiles(directory, includes, excludes)
  if (files.length === 0) return []

  const { sourceFiles } = createAnalysisProject(directory, files)
  const suggestions: CohesionSuggestion[] = []

  for (const sourceFile of sourceFiles) {
    for (const classDeclaration of sourceFile.getClasses()) {
      const groups = getCohesionGroups(classDeclaration)
      if (groups.length <= 1) continue

      suggestions.push({ value: classDeclaration.getName() ?? '[UnnamedClass]', groups })
    }
  }

  return suggestions
}

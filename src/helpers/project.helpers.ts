import { Project, SourceFile } from 'ts-morph'

import { findTsConfig } from './file.helpers'

// Loads the project's tsconfig (when present) so path aliases and compiler options are
// honored during resolution, while restricting analysis to the globbed files only.
export const createAnalysisProject = (directory: string, files: string[]): { project: Project; sourceFiles: SourceFile[] } => {
  const tsConfigFilePath = findTsConfig(directory)

  const project = tsConfigFilePath
    ? new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true })
    : new Project()

  const sourceFiles = project.addSourceFilesAtPaths(files)
  return { project, sourceFiles }
}

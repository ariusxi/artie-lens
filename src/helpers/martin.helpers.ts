import { SourceFile } from 'ts-morph'

export interface MartinMetrics {
  ca: number
  ce: number
  instability: number
  abstractness: number
  distance: number
}

// Robert Martin's package metrics, per module:
//   Ce afferent, Ca efferent, I = Ce/(Ca+Ce), A = abstract types / all types,
//   D = |A + I - 1| (distance from the main sequence, 0 good, 1 bad).
export const computeMartin = (graph: Map<string, Set<string>>, sourceFiles: SourceFile[]): Map<string, MartinMetrics> => {
  const byPath = new Map(sourceFiles.map((sourceFile) => [sourceFile.getFilePath(), sourceFile]))

  const afferent = new Map<string, number>()
  for (const [, dependencies] of graph) {
    for (const to of dependencies) afferent.set(to, (afferent.get(to) ?? 0) + 1)
  }

  const result = new Map<string, MartinMetrics>()

  for (const [path, dependencies] of graph) {
    const ce = dependencies.size
    const ca = afferent.get(path) ?? 0
    const coupling = ca + ce
    const instability = coupling === 0 ? 0 : ce / coupling

    const sourceFile = byPath.get(path)
    let abstractCount = sourceFile ? sourceFile.getInterfaces().length : 0
    let concreteCount = 0
    for (const classDeclaration of sourceFile?.getClasses() ?? []) {
      if (classDeclaration.isAbstract()) {
        abstractCount += 1
        continue
      }
      concreteCount += 1
    }
    const totalTypes = abstractCount + concreteCount
    const abstractness = totalTypes === 0 ? 0 : abstractCount / totalTypes

    // Only meaningful for coupled modules; an isolated file has no distance to report.
    const distance = coupling === 0 ? 0 : Math.abs(abstractness + instability - 1)
    result.set(path, { ca, ce, instability, abstractness, distance })
  }

  return result
}

import { relative } from 'path'
import { Identifier, Node, SourceFile } from 'ts-morph'
import picomatch from 'picomatch'

import { AnalysisContext } from './metric.helpers'

export interface DeadExport {
  file: string
  name: string
  kind: string
  line: number
}

interface NamedExport {
  name: string
  kind: string
  nameNode: Identifier
}

// Every named export a file declares itself (re-exports from barrels are export statements, not
// declarations, so they are left out on purpose: a barrel is a pass-through, not the owner).
const collectExports = (sourceFile: SourceFile): NamedExport[] => {
  const exports: NamedExport[] = []
  const push = (kind: string, node: { isExported(): boolean; getNameNode(): Node | undefined; getName(): string | undefined }): void => {
    const nameNode = node.getNameNode()
    if (!node.isExported() || !node.getName() || !nameNode || !Node.isIdentifier(nameNode)) return
    exports.push({ name: node.getName()!, kind, nameNode: nameNode as Identifier })
  }

  for (const declaration of sourceFile.getFunctions()) push('function', declaration)
  for (const declaration of sourceFile.getClasses()) push('class', declaration)
  for (const declaration of sourceFile.getInterfaces()) push('interface', declaration)
  for (const declaration of sourceFile.getTypeAliases()) push('type', declaration)
  for (const declaration of sourceFile.getEnums()) push('enum', declaration)
  for (const declaration of sourceFile.getVariableDeclarations()) push('const', declaration)

  return exports
}

// An export is dead when nothing references it beyond its own declaration. A same-file use still
// counts as alive (the symbol is used, it just need not be exported) so genuine internal helpers
// are not reported. findReferencesAsNodes lists the declaration name itself, so it is excluded by
// position before deciding.
const isUsed = (item: NamedExport): boolean => {
  const declStart = item.nameNode.getStart()
  const declFile = item.nameNode.getSourceFile()
  return item.nameNode
    .findReferencesAsNodes()
    .some((reference) => reference.getStart() !== declStart || reference.getSourceFile() !== declFile)
}

export const findDeadExports = (context: AnalysisContext, entries: string[] = []): DeadExport[] => {
  const isEntry = entries.length ? picomatch(entries) : () => false
  const dead: DeadExport[] = []

  for (const sourceFile of context.sourceFiles) {
    const file = relative(context.directory, sourceFile.getFilePath())
    if (isEntry(file)) continue

    for (const item of collectExports(sourceFile)) {
      if (isUsed(item)) continue
      dead.push({ file, name: item.name, kind: item.kind, line: item.nameNode.getStartLineNumber() })
    }
  }

  return dead.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

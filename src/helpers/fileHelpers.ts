import fg from 'fast-glob'
import path from 'path'
import { readdirSync, readFileSync } from 'fs'
import { CompilerOptions, parseConfigFileTextToJson, parseJsonConfigFileContent, Program, readConfigFile, ScriptTarget, SourceFile, sys } from 'typescript'

export async function getSourceFiles(directory: string, includes: string[], excludes: string[]): Promise<string[]> {
  return await fg(includes, {
    cwd: directory,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: excludes,
  })
}

export function readFileContent(directory: string): string {
  return readFileSync(directory, 'utf-8')
}

export function getProjectConfigPath(directory: string): string {
  const configFile = readdirSync(directory).find((file: string) => {
    return file.startsWith('tsconfig') && file.endsWith('.json')
  })

  if (!configFile) {
    throw new Error('⚠️ tsconfig.json not found.')
  }

  return path.join(directory, configFile)
}

export function getProjectTarget(configContent: string): ScriptTarget {
  const result = parseConfigFileTextToJson('tsconfig.json', configContent)
  const configs = result.config ?? {}
  const target = configs.compilerOptions?.target

  return ScriptTarget[target as keyof typeof ScriptTarget] ?? ScriptTarget.ES2015
}

export function getCompilerOptions(configPath: string): CompilerOptions {
  const configFile = readConfigFile(configPath, sys.readFile)
  if (configFile.error) {
    throw new Error(`Failed to read tsconfig.json: ${configFile.error.messageText}`)
  }

  const projectConfig = parseJsonConfigFileContent(configFile.config, sys, path.resolve(configPath))
  return projectConfig.options
}

export function getSourceFileByPath(filePath: string, program: Program): SourceFile | void {
  return program.getSourceFiles().find((file) => file.fileName === filePath)
}
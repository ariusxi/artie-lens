import { relative, sep } from 'path'
import picomatch from 'picomatch'

import { ArchitectureRule, RuleViolation } from '../types/config.interface'

const toArray = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value])

// Globs are always written with forward slashes, so normalize Windows separators.
const toGlobPath = (directory: string, path: string): string => relative(directory, path).split(sep).join('/')

const defaultMessage = (from: string, to: string): string => `${from} must not import ${to}`

// Checks declarative boundary rules against the import graph. A rule can forbid targets
// (cannotImport) or restrict a module to an allowlist (canOnlyImport).
export const checkRules = (graph: Map<string, Set<string>>, directory: string, rules: ArchitectureRule[]): RuleViolation[] => {
  const violations: RuleViolation[] = []

  for (const rule of rules) {
    const matchesSource = picomatch(toArray(rule.from))
    const isForbidden = rule.cannotImport ? picomatch(toArray(rule.cannotImport)) : null
    const isAllowed = rule.canOnlyImport ? picomatch(toArray(rule.canOnlyImport)) : null

    for (const [path, dependencies] of graph) {
      const from = toGlobPath(directory, path)
      if (!matchesSource(from)) continue

      for (const dependency of dependencies) {
        const to = toGlobPath(directory, dependency)

        const forbidden = isForbidden ? isForbidden(to) : false
        const outsideAllowlist = isAllowed ? !isAllowed(to) : false
        if (!forbidden && !outsideAllowlist) continue

        violations.push({ from, to, message: rule.message ?? defaultMessage(from, to) })
      }
    }
  }

  return violations
}

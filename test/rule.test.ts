import { describe, expect, it } from 'vitest'

import { checkRules } from '../src/helpers/rule.helpers'
import { ArchitectureRule } from '../src/types/config.interface'

const ROOT = '/project'

const graph = (edges: Record<string, string[]>): Map<string, Set<string>> =>
  new Map(Object.entries(edges).map(([node, deps]) => [`${ROOT}/${node}`, new Set(deps.map((dep) => `${ROOT}/${dep}`))]))

describe('checkRules', () => {
  it('flags an import that crosses a forbidden boundary', () => {
    const rules: ArchitectureRule[] = [
      { from: 'src/domain/**', cannotImport: ['src/infra/**'], message: 'domain must not depend on infra' },
    ]
    const imports = graph({ 'src/domain/user.ts': ['src/infra/db.ts'], 'src/domain/order.ts': [] })

    const violations = checkRules(imports, ROOT, rules)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      from: 'src/domain/user.ts',
      to: 'src/infra/db.ts',
      message: 'domain must not depend on infra',
    })
  })

  it('allows imports that stay inside the boundary', () => {
    const rules: ArchitectureRule[] = [{ from: 'src/domain/**', cannotImport: ['src/infra/**'] }]
    const imports = graph({ 'src/domain/user.ts': ['src/domain/order.ts'] })

    expect(checkRules(imports, ROOT, rules)).toHaveLength(0)
  })

  it('enforces an allowlist with canOnlyImport', () => {
    const rules: ArchitectureRule[] = [{ from: 'src/domain/**', canOnlyImport: ['src/domain/**'] }]
    const imports = graph({ 'src/domain/user.ts': ['src/domain/order.ts', 'src/utils/date.ts'] })

    const violations = checkRules(imports, ROOT, rules)

    expect(violations).toHaveLength(1)
    expect(violations[0].to).toBe('src/utils/date.ts')
  })

  it('falls back to a default message and ignores modules outside the rule', () => {
    const rules: ArchitectureRule[] = [{ from: 'src/domain/**', cannotImport: ['src/infra/**'] }]
    const imports = graph({
      'src/domain/user.ts': ['src/infra/db.ts'],
      'src/app/main.ts': ['src/infra/db.ts'],
    })

    const violations = checkRules(imports, ROOT, rules)

    expect(violations).toHaveLength(1)
    expect(violations[0].message).toBe('src/domain/user.ts must not import src/infra/db.ts')
  })
})

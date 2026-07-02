import { afterEach, describe, expect, it } from 'vitest'

import { suggestCohesion, suggestCycles } from '../src/helpers/suggest.helpers'
import { cleanupProjects, createProject } from './utils'

afterEach(() => cleanupProjects())

describe('suggestCohesion', () => {
  it('splits a low-cohesion class into its disjoint method groups', async () => {
    const directory = createProject({
      'mixed.ts': `export class Mixed {
        private user = ''
        private cart: string[] = []
        login(u: string): void { this.user = u }
        logout(): void { this.user = '' }
        addItem(i: string): void { this.cart.push(i) }
        clearCart(): void { this.cart = [] }
      }`,
    })

    const suggestions = await suggestCohesion(directory, ['**/*.ts'], [])

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].value).toBe('Mixed')
    expect(suggestions[0].groups).toHaveLength(2)
    const grouped = suggestions[0].groups.map((group) => group.methods.sort().join(','))
    expect(grouped.sort()).toEqual(['addItem,clearCart', 'login,logout'])
  })

  it('does not suggest anything for a cohesive class', async () => {
    const directory = createProject({
      'counter.ts': `export class Counter {
        private count = 0
        increment(): void { this.count += 1 }
        value(): number { return this.count }
      }`,
    })

    expect(await suggestCohesion(directory, ['**/*.ts'], [])).toHaveLength(0)
  })
})

describe('suggestCycles', () => {
  it('reports the modules that form an import cycle', async () => {
    const directory = createProject({
      'a.ts': `import { b } from './b'
        export const a = () => b`,
      'b.ts': `import { a } from './a'
        export const b = () => a`,
      'c.ts': `export const c = 1`,
    })

    const suggestions = await suggestCycles(directory, ['**/*.ts'], [])

    expect(suggestions).toHaveLength(1)
    expect([...suggestions[0].modules].sort()).toEqual(['a.ts', 'b.ts'])
  })
})

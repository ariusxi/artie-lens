import { afterEach, describe, expect, it } from 'vitest'

import { calculateCBO, calculateDIT, calculateLCOM, calculateNOC, calculateRFC, calculateWMC } from '../src/helpers/metricHelpers'
import { cleanupProjects, createProject, thresholds, totalOf } from './utils'

const run = (fn: typeof calculateWMC, directory: string) => fn(directory, thresholds, ['**/*.ts'], [])

afterEach(() => cleanupProjects())

describe('WMC (Weighted Methods per Class)', () => {
  it('counts one per trivial method (unit weight baseline)', async () => {
    const directory = createProject({
      'simple.ts': `export class Simple {
        a(): number { return 1 }
        b(): number { return 2 }
        c(): number { return 3 }
      }`,
    })

    expect(totalOf(await run(calculateWMC, directory), 'Simple')).toBe(3)
  })

  it('adds cyclomatic complexity per method and ignores free functions', async () => {
    const directory = createProject({
      'complex.ts': `
        export function free(x: number): number {
          if (x > 0) return 1
          if (x < 0) return -1
          return 0
        }

        export class Complex {
          process(items: number[], flag: boolean): number {
            let sum = 0
            for (const item of items) {
              if (item > 0 && flag) {
                sum += item
              }
            }
            return sum > 0 ? sum : 0
          }
        }`,
    })

    expect(totalOf(await run(calculateWMC, directory), 'Complex')).toBe(5)
  })

  it('includes constructor, accessors and arrow-function fields', async () => {
    const directory = createProject({
      'members.ts': `export class Members {
        private v = 0
        constructor(seed: number) { if (seed > 0) this.v = seed }
        get value(): number { return this.v }
        compute = (n: number) => n > 0 ? n : -n
        reset(): void { this.v = 0 }
      }`,
    })

    expect(totalOf(await run(calculateWMC, directory), 'Members')).toBe(6)
  })
})

describe('CBO (Coupling Between Object classes)', () => {
  const deps = `
    export class Repo { save(): void {} }
    export class Mailer { send(): void {} }
    export class Logger { log(): void {} }
    export class Base { baseMethod(): void {} }
    export interface Handler { handle(): void }`

  it('counts heritage coupling even when the class has no members', async () => {
    const directory = createProject({
      'deps.ts': deps,
      'child.ts': `import { Base } from './deps'
        export class Child extends Base {}`,
    })

    expect(totalOf(await run(calculateCBO, directory), 'Child')).toBe(1)
  })

  it('captures method-body usage and property types, ignoring interfaces and self', async () => {
    const directory = createProject({
      'deps.ts': deps,
      'service.ts': `import { Repo, Mailer, Logger, Handler } from './deps'
        export class UserService implements Handler {
          private repo!: Repo
          constructor(private mailer: Mailer) {}
          handle(): void {
            const logger = new Logger()
            logger.log()
            this.repo.save()
            this.mailer.send()
            this.self()
          }
          self(): void {}
        }`,
    })

    expect(totalOf(await run(calculateCBO, directory), 'UserService')).toBe(3)
  })

  it('is zero for a self-contained class', async () => {
    const directory = createProject({ 'deps.ts': deps })

    expect(totalOf(await run(calculateCBO, directory), 'Repo')).toBe(0)
  })
})

describe('RFC (Response For a Class)', () => {
  it('counts own methods plus first-level calls, excluding library calls', async () => {
    const directory = createProject({
      'base.ts': `export class Base { baseMethod(): void {} }`,
      'helper.ts': `export function helper(): void {}`,
      'notifier.ts': `export class Notifier { notify(): void {} }`,
      'sample.ts': `import { Base } from './base'
        import { helper } from './helper'
        import { Notifier } from './notifier'
        export class Sample extends Base {
          private count = 0
          private notifier = new Notifier()
          get value(): number { return this.count }
          handleClick = () => { this.increment() }
          increment(): void { this.count += 1; this.log(); helper() }
          log(): void { console.log(this.count); this.baseMethod(); this.notifier.notify() }
        }`,
    })

    // value, handleClick, increment, log (own) + helper + Base.baseMethod + Notifier.notify = 7
    // console.log is a library call and is excluded
    expect(totalOf(await run(calculateRFC, directory), 'Sample')).toBe(7)
  })

  it('is zero for an empty class', async () => {
    const directory = createProject({ 'empty.ts': `export class Empty {}` })

    expect(totalOf(await run(calculateRFC, directory), 'Empty')).toBe(0)
  })
})

describe('LCOM (Lack of Cohesion in Methods)', () => {
  it('is zero when no method uses instance variables', async () => {
    const directory = createProject({
      'utils.ts': `export class MathUtils {
        add(a: number, b: number): number { return a + b }
        sub(a: number, b: number): number { return a - b }
        mul(a: number, b: number): number { return a * b }
      }`,
    })

    expect(totalOf(await run(calculateLCOM, directory), 'MathUtils')).toBe(0)
  })

  it('does not confuse a variable with another whose name is a prefix', async () => {
    const directory = createProject({
      'account.ts': `export class Account {
        private id = 0
        private identifier = ''
        readId(): number { return this.id }
        readIdentifier(): string { return this.identifier }
      }`,
    })

    expect(totalOf(await run(calculateLCOM, directory), 'Account')).toBe(1)
  })

  it('treats arrow fields and accessors as cohesive methods', async () => {
    const directory = createProject({
      'counter.ts': `export class Counter {
        private count = 0
        increment = () => { this.count += 1 }
        get value(): number { return this.count }
        reset(): void { this.count = 0 }
      }`,
    })

    expect(totalOf(await run(calculateLCOM, directory), 'Counter')).toBe(0)
  })

  it('excludes statics and counts constructor parameter properties', async () => {
    const directory = createProject({
      'service.ts': `export class Repo { find(): void {} }
        export class UserService {
          constructor(private repo: Repo) {}
          static create(): void {}
          load(): void { this.repo.find() }
          save(): void { this.repo.find() }
        }`,
    })

    expect(totalOf(await run(calculateLCOM, directory), 'UserService')).toBe(0)
  })

  it('detects two disjoint responsibility groups', async () => {
    const directory = createProject({
      'mixed.ts': `export class Mixed {
        private a = 0
        private b = 0
        useA1(): number { return this.a }
        useA2(): void { this.a = 1 }
        useB1(): number { return this.b }
        useB2(): void { this.b = 1 }
      }`,
    })

    expect(totalOf(await run(calculateLCOM, directory), 'Mixed')).toBe(2)
  })
})

describe('DIT (Depth of Inheritance Tree)', () => {
  it('counts the depth of the extends chain across files', async () => {
    const directory = createProject({
      'root.ts': `export class Root {}`,
      'level1.ts': `import { Root } from './root'
        export class Level1 extends Root {}`,
      'level2.ts': `import { Level1 } from './level1'
        export class Level2 extends Level1 {}`,
    })

    const results = await run(calculateDIT, directory)
    expect(totalOf(results, 'Root')).toBe(0)
    expect(totalOf(results, 'Level1')).toBe(1)
    expect(totalOf(results, 'Level2')).toBe(2)
  })
})

describe('NOC (Number of Children)', () => {
  it('counts only immediate subclasses, not deeper descendants', async () => {
    const directory = createProject({
      'base.ts': `export class Base {}`,
      'children.ts': `import { Base } from './base'
        export class ChildA extends Base {}
        export class ChildB extends Base {}
        export class GrandChild extends ChildA {}`,
    })

    const results = await run(calculateNOC, directory)
    expect(totalOf(results, 'Base')).toBe(2)
    expect(totalOf(results, 'ChildA')).toBe(1)
    expect(totalOf(results, 'ChildB')).toBe(0)
    expect(totalOf(results, 'GrandChild')).toBe(0)
  })
})

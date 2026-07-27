import { Project } from 'ts-morph'
import { describe, expect, it } from 'vitest'

import { getCognitiveComplexity } from '../src/helpers/cognitive.helpers'

const cognitiveOf = (code: string): number => {
  const project = new Project({ useInMemoryFileSystem: true })
  const sourceFile = project.createSourceFile('t.ts', code)
  return getCognitiveComplexity(sourceFile.getClasses()[0])
}

describe('getCognitiveComplexity', () => {
  it('scores a class with no control flow as zero', () => {
    expect(cognitiveOf('class C { m() { return 1 } }')).toBe(0)
  })

  it('adds one per flat branch', () => {
    expect(cognitiveOf('class C { m() { if (a) {} if (b) {} if (c) {} } }')).toBe(3)
  })

  it('punishes nesting: the same three ifs nested cost far more', () => {
    // if(+1) > if(+1+1) > if(+1+2) = 6
    expect(cognitiveOf('class C { m() { if (a) { if (b) { if (c) {} } } } }')).toBe(6)
  })

  it('counts else-if and else as flat increments', () => {
    expect(cognitiveOf('class C { m() { if (a) {} else if (b) {} else {} } }')).toBe(3)
  })

  it('counts a boolean sequence once, a mixed one twice', () => {
    expect(cognitiveOf('class C { m() { if (a && b && c) {} } }')).toBe(2) // if + one sequence
    expect(cognitiveOf('class C { m() { if (a && b || c) {} } }')).toBe(3) // if + two sequences
  })

  it('adds the loop nesting to a branch inside it', () => {
    // for(+1) then if at nesting 1 (+1+1) = 3
    expect(cognitiveOf('class C { m() { for (;;) { if (a) {} } } }')).toBe(3)
  })

  it('sums across every method in the class', () => {
    expect(cognitiveOf('class C { a() { if (x) {} } b() { if (y) {} } }')).toBe(2)
  })
})

import { describe, expect, it } from 'vitest'

import { createLatestRunQueue } from '../src/helpers/run-queue.helpers'

const nextTurn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('createLatestRunQueue', () => {
  it('serializes work and coalesces requests made during a run', async () => {
    let active = 0
    let maximumActive = 0
    let executions = 0
    const releases: (() => void)[] = []
    const queue = createLatestRunQueue(async () => {
      active += 1
      executions += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active -= 1
    })

    const first = queue.run()
    const second = queue.run()
    const third = queue.run()

    expect(executions).toBe(1)
    releases.shift()!()
    await nextTurn()
    expect(executions).toBe(2)
    expect(maximumActive).toBe(1)

    releases.shift()!()
    await Promise.all([first, second, third])
    expect(executions).toBe(2)
  })

  it('continues processing after a failed execution', async () => {
    let executions = 0
    const queue = createLatestRunQueue(async () => {
      executions += 1
      if (executions === 1) throw new Error('failed')
    })

    await expect(queue.run()).rejects.toThrow('failed')
    await expect(queue.run()).resolves.toBeUndefined()
    expect(executions).toBe(2)
  })
})

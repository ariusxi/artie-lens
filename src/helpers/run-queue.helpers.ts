interface Waiter {
  resolve: () => void
  reject: (error: unknown) => void
}

export interface LatestRunQueue {
  run: () => Promise<void>
}

// Serializes an expensive task and coalesces every request received while it is running into one
// follow-up execution. Each caller resolves only after the execution covering its request ends.
export const createLatestRunQueue = (task: () => Promise<void>): LatestRunQueue => {
  let active = false
  let requested = false
  let waiters: Waiter[] = []

  const drain = async (): Promise<void> => {
    while (requested) {
      requested = false
      const batch = waiters
      waiters = []

      try {
        await task()
        for (const waiter of batch) waiter.resolve()
      } catch (error) {
        for (const waiter of batch) waiter.reject(error)
      }
    }

    active = false
  }

  return {
    run: () => new Promise<void>((resolve, reject) => {
      waiters.push({ resolve, reject })
      requested = true
      if (active) return

      active = true
      void drain()
    }),
  }
}

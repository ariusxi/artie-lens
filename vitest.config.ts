import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 68,
        functions: 82,
        lines: 82,
      },
    },
  },
})

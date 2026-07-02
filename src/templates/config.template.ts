export const configTemplate = {
  options: {
    defaultThresholds: {
      warning: 10,
      critical: 20,
      levels: ["OK", "WARNING", "CRITICAL"]
    },
    metrics: {
      lcom: {
        enabled: true,
        warning: 5,
        critical: 10
      },
      wmc: {
        enabled: true,
        warning: 10,
        critical: 25
      },
      rfc: {
        enabled: true,
        warning: 15,
        critical: 30
      },
      cbo: {
        enabled: true
      },
      dit: {
        enabled: true,
        warning: 4,
        critical: 6
      },
      noc: {
        enabled: true,
        warning: 10,
        critical: 20
      },
      ce: {
        enabled: true,
        warning: 8,
        critical: 15
      },
      cyclic: {
        enabled: true,
        warning: 1,
        critical: 1
      }
    }
  },
  includes: ['**/*.ts', '!**/*.d.ts'],
  excludes: [
    "**/*.test.ts",
    "node_modules",
    "dist",
    "scripts/**"
  ]
}

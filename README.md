# Artie-Lens
A TypeScript library for managing code metrics with flexible configuration.

## 💾 Installation
```bash
# Install globally
npm install -g artie-lens
```
If using locally during development:
```bash
git clone <repo-url>
cd artie
npm install
npm run build
npm link # makes the CLI globally available
```

## ⚡️ Project Initialization
To create the base configuration file artierc.json in the current directory:
```bash
artie init
```
This will generate an artierc.json file at the project root:
```json
{
  "options": {
    "defaultThresholds": {
      "warning": 10,
      "critical": 20,
      "levels": ["OK", "WARNING", "ERROR"]
    },
    "metrics": {
      "lcom": { "enabled": true, "warning": 5, "critical": 10 },
      "wmc": { "enabled": true, "warning": 10, "critical": 25 },
      "rfc": { "enabled": true, "warning": 15, "critical": 30 },
      "cbo": { "enabled": false }
    }
  },
  "include": [
    "**/*.ts",
    "!**/*.d.ts"
  ],
  "exclude": [
    "**/*.test.ts",
    "node_modules",
    "dist",
    "scripts/**"
  ]
}
```

## 🔎 Project Analysis
To analyze the projects using the defined configuration:
```bash
artie run
```
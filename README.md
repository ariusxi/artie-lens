# Artie.JS
Uma biblioteca em TypeScript para gerenciamento de métricas de código com configuração flexível.

## 💾 Instalação
```bash
# Instalar módulo global
npm install -g artie.js
```
Se estiver usando localmente durante o desenvolvimento:
```bash
git clone <repo-url>
cd artie.js
npm install
npm run build
npm link # torna a CLI globalmente disponível
```

## ⚡️ Inicialização do projeto
Para criar o arquivo de configuração base `artierc.json` no diretório atual:
```bash
artie.js init
```
Isso vai gerar um arquivo `artierc.json` na raiz do projeto:
```json
{
  "options": {
    "defaultThresholds": {
      "warning": 10,
      "critical": 20
    },
    "metrics": {
      "lcom": { "enabled": true, "warning": 5, "critical": 10 },
      "wmc": { "enabled": true, "warning": 10, "critical": 25 },
      "rfc": { "enabled": true, "warning": 15, "critical": 30 },
      "cbo": { "enabled": false }
    }
  },
  "include": ["src/**/*.ts", "services/**/*.ts"],
  "exclude": ["**/*.test.ts", "node_modules", "dist", "scripts/**"]
}
```

## 🛠️ Uso
Inicializar análise de arquitetura:
```bash
artie.js run
```
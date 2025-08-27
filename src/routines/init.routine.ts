import path from 'path'
import { existsSync, writeFileSync } from 'fs'

import { configTemplate } from '../templates/config'

export function initConfig(): void {
  const filePath = path.resolve(process.cwd(), '.artierc.json')
  if (existsSync(filePath)) {
    return console.log("⚠️  The file .artierc.json already exists on the current directory.")
  }

  const configContent = JSON.stringify(configTemplate, null, 2)
  writeFileSync(filePath, configContent)

  console.log('✅ File .artierc.json created!')
}
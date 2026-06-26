import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
let loaded = false

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim()

  if (!trimmed || trimmed.startsWith('#')) {
    return null
  }

  const separatorIndex = trimmed.indexOf('=')

  if (separatorIndex === -1) {
    return null
  }

  const key = trimmed.slice(0, separatorIndex).trim()
  const rawValue = trimmed.slice(separatorIndex + 1).trim()
  const value = rawValue.replace(/^["']|["']$/g, '')

  return key ? [key, value] : null
}

export function loadLocalEnv(): void {
  if (loaded) {
    return
  }

  loaded = true

  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env'),
    join(currentDir, '..', '..', '..', '.env'),
    join(currentDir, '..', '..', '..', '..', '..', '.env')
  ]

  const envFile = candidates.find((candidate) => existsSync(candidate))

  if (!envFile) {
    return
  }

  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const entry = parseEnvLine(line)

    if (!entry) {
      continue
    }

    const [key, value] = entry
    process.env[key] ??= value
  }
}

loadLocalEnv()

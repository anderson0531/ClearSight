import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleAuth } from 'google-auth-library'

const ROOT = process.cwd()
const MESSAGES_DIR = join(ROOT, 'src/i18n/messages')

const LOCALES = [
  'es', 'zh', 'hi', 'ar', 'pt', 'ru', 'ja', 'de', 'fr', 'ko',
  'it', 'tr', 'vi', 'id', 'nl', 'pl', 'th', 'uk', 'bn',
]

function parseCredentialsJson(raw) {
  const trimmed = raw.trim()
  const candidates = [trimmed]
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    candidates.unshift(trimmed.slice(1, -1))
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      /* try next */
    }
    try {
      return JSON.parse(Buffer.from(candidate, 'base64').toString('utf8'))
    } catch {
      /* try next */
    }
  }
  return null
}

function loadCredentials() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (fromEnv) return parseCredentialsJson(fromEnv)
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) return null
  const match = readFileSync(envPath, 'utf8').match(/^GOOGLE_APPLICATION_CREDENTIALS_JSON=(.*)$/m)
  return match ? parseCredentialsJson(match[1]) : null
}

async function getAccessToken() {
  const credentials = loadCredentials()
  if (!credentials) throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON')
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  return auth.getAccessToken()
}

function loadEnglishKeys() {
  const enPath = join(MESSAGES_DIR, 'en.json')
  return JSON.parse(readFileSync(enPath, 'utf8'))
}

async function translateBatch(texts, target) {
  const token = await getAccessToken()
  const res = await fetch('https://translation.googleapis.com/language/translate/v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: texts,
      target,
      source: 'en',
      format: 'text',
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Translation API ${res.status}: ${body}`)
  }
  const data = await res.json()
  return data.data.translations.map((item) => item.translatedText)
}

async function translateLocale(code, english) {
  const keys = Object.keys(english)
  const values = Object.values(english)
  const batchSize = 50
  const translated = []

  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize)
    const result = await translateBatch(batch, code)
    translated.push(...result)
    console.log(`  batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(values.length / batchSize)}`)
  }

  const out = {}
  keys.forEach((key, index) => {
    out[key] = translated[index] ?? english[key]
  })

  const outPath = join(MESSAGES_DIR, `${code}.json`)
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`Wrote ${outPath}`)
}

async function main() {
  const english = loadEnglishKeys()
  writeFileSync(join(MESSAGES_DIR, 'en.json'), `${JSON.stringify(english, null, 2)}\n`)

  for (const code of LOCALES) {
    console.log(`Translating ${code}…`)
    try {
      await translateLocale(code, english)
    } catch (error) {
      console.error(`Failed ${code}:`, error.message)
    }
  }
}

main()

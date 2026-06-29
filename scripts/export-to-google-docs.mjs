#!/usr/bin/env node
/**
 * Upload multi-tier pricing doc to Google Drive as a Google Doc.
 *
 * Requires: gcloud auth with Drive scope, or GOOGLE_ACCESS_TOKEN env var.
 *
 *   gcloud auth login --enable-gdrive-access
 *   node scripts/export-to-google-docs.mjs
 *
 * Optional: GOOGLE_DRIVE_FOLDER_ID to place the doc in a folder.
 */
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HTML_PATH = path.join(__dirname, '../output/multi-tier-pricing-model.html')
const DOC_TITLE = 'ClearSight — Multi-tier Plans, Dual Credits, and Margin Model'

function getAccessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN?.trim()) {
    return process.env.GOOGLE_ACCESS_TOKEN.trim()
  }
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

async function uploadAsGoogleDoc(token) {
  const html = readFileSync(HTML_PATH, 'utf8')
  const boundary = 'clearsight_export_boundary'
  const metadata = {
    name: DOC_TITLE,
    mimeType: 'application/vnd.google-apps.document',
  }
  if (process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()) {
    metadata.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID.trim()]
  }

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
    `${html}\r\n` +
    `--${boundary}--`

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Drive API ${res.status}: ${JSON.stringify(data)}`)
  }
  return data
}

async function main() {
  const token = getAccessToken()
  if (!token) {
    console.error('No Google access token. Run: gcloud auth login --enable-gdrive-access')
    console.error(`Or import manually: upload ${HTML_PATH} to Google Drive (converts to Google Doc).`)
    process.exit(1)
  }

  console.log('Uploading to Google Drive as Google Doc…')
  const file = await uploadAsGoogleDoc(token)
  console.log('\nGoogle Doc created successfully:\n')
  console.log(`  Title: ${file.name}`)
  console.log(`  Open:  ${file.webViewLink}`)
  console.log(`  ID:    ${file.id}`)
}

main().catch((err) => {
  console.error('Export failed:', err.message)
  console.error(`\nManual import: open Google Drive → New → File upload → select:\n  ${HTML_PATH}`)
  process.exit(1)
})

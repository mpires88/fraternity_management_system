/**
 * Backfill structured address + emergency contact fields from CSV.
 *
 * Run:  npx tsx --env-file=.env.local scripts/backfill-address-emergency.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.split('\n')
  const headers = parseLine(lines[0])
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const vals = parseLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h.trim()] = (vals[i] ?? '').trim()
      })
      return row
    })
}

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
      continue
    }
    current += ch
  }
  result.push(current)
  return result
}

function cleanName(raw: string): string {
  const match = raw.match(/^(?:\d+\s+)?(.+?)(?:\s*\(Brother .+?\))?\s*$/)
  return match ? match[1].trim() : raw.trim()
}

function cleanPhone(raw: string): string | null {
  const stripped = raw.replace(/[^\d+\-() ]/g, '').trim()
  return stripped.length >= 7 ? stripped : null
}

async function main() {
  const csv = readFileSync('test data/Contacts-Full Roster (1).csv', 'utf-8')
  const rows = parseCSV(csv)
  console.log(`Parsed ${rows.length} rows\n`)

  const { data: persons } = await supabase.from('persons').select('id, full_name')
  const personMap = new Map((persons ?? []).map((p) => [p.full_name, p.id]))

  let updated = 0

  for (const row of rows) {
    const rawName = row['FULL NAME'] ?? ''
    if (!rawName.trim()) continue
    const fullName = cleanName(rawName)
    const personId = personMap.get(fullName)
    if (!personId) continue

    const city = (row['HOMETOWN'] ?? '').trim() || null
    const state = (row['HOMETOWN STATE (IF APPLICABLE)'] ?? '').trim() || null
    const country = (row['HOMETOWN COUNTRY'] ?? '').trim() || null
    const ecName = (row['Emergency Contact'] ?? '').trim() || null
    const ecPhone = cleanPhone(row['Emergency Contact Phone Number'] ?? '')

    const update: Record<string, unknown> = {}
    if (city) update.city = city
    if (state) update.state = state
    if (country) update.country = country
    if (ecName) update.emergency_contact_name = ecName
    if (ecPhone) update.emergency_contact_phone = ecPhone

    if (Object.keys(update).length === 0) continue

    await supabase.from('persons').update(update).eq('id', personId)
    updated++
  }

  console.log(`Updated: ${updated}`)
  console.log('Done!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

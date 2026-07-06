/**
 * Backfill first_name, middle_name, last_name, preferred_name,
 * family_line, pledge_class_name, bid_date from CSV.
 *
 * Run:  npx tsx --env-file=.env.local scripts/backfill-names.ts
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

function parseDate(raw: string): string | null {
  if (!raw || raw === 'NaN') return null
  const parts = raw.split('/')
  if (parts.length === 3) {
    const [m, d, y] = parts
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

async function main() {
  const csv = readFileSync('test data/Contacts-Full Roster (1).csv', 'utf-8')
  const rows = parseCSV(csv)
  console.log(`Parsed ${rows.length} rows\n`)

  // Get all persons keyed by full_name
  const { data: persons } = await supabase.from('persons').select('id, full_name')
  const personMap = new Map((persons ?? []).map((p) => [p.full_name, p.id]))

  let updated = 0
  let skipped = 0

  for (const row of rows) {
    const rawName = row['FULL NAME'] ?? ''
    if (!rawName.trim()) {
      skipped++
      continue
    }

    const fullName = cleanName(rawName)
    const personId = personMap.get(fullName)
    if (!personId) {
      skipped++
      continue
    }

    const firstName = (row['FIRST NAME'] ?? '').trim() || null
    const middleName = (row['Middle Name'] ?? '').trim() || null
    const lastName = (row['LAST NAME'] ?? '').trim() || null
    const preferredName = (row['PREFERRED NAME'] ?? '').trim() || null
    const familyLine = (row['FAMILY LINE'] ?? '').trim() || null
    const pledgeClassName = (row['PLEDGE CLASS'] ?? '').trim() || null
    const bidDate = parseDate(row['Bid Date'] ?? '')

    const update: Record<string, unknown> = {}
    if (firstName) update.first_name = firstName
    if (middleName) update.middle_name = middleName
    if (lastName) update.last_name = lastName
    if (preferredName) update.preferred_name = preferredName
    if (familyLine) update.family_line = familyLine
    if (pledgeClassName) update.pledge_class_name = pledgeClassName
    if (bidDate) update.bid_date = bidDate

    if (Object.keys(update).length === 0) {
      skipped++
      continue
    }

    const { error } = await supabase.from('persons').update(update).eq('id', personId)

    if (error) {
      console.error(`  Error ${fullName}: ${error.message}`)
      skipped++
    } else {
      updated++
    }
  }

  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
  console.log('\nDone!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

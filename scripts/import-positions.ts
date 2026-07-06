/**
 * Import position history from CSV into position_assignments.
 *
 * Run:  npx tsx --env-file=.env.local scripts/import-positions.ts
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

/**
 * Parse "2025 Spring - Rush Chair" → { year: 2025, termSlug: 'spring', positionTitle: 'Rush Chair' }
 */
function parsePositionEntry(
  entry: string
): { year: number; termSlug: string; title: string } | null {
  const trimmed = entry.trim()
  // Pattern: "YYYY TermName - Position Title"
  const match = trimmed.match(/^(\d{4})\s+(Fall|Spring|Summer)\s*-\s*(.+)$/i)
  if (!match) return null
  return {
    year: parseInt(match[1], 10),
    termSlug: match[2].toLowerCase(),
    title: match[3].trim(),
  }
}

async function main() {
  const csv = readFileSync('test data/Contacts-Full Roster (1).csv', 'utf-8')
  const rows = parseCSV(csv)
  console.log(`Parsed ${rows.length} rows\n`)

  // Get org
  const { data: org } = await supabase
    .from('orgs')
    .select('id, fraternity_id')
    .eq('slug', 'undergrad')
    .single()
  if (!org) throw new Error('Org not found')

  // Get person map: full_name → id
  const { data: persons } = await supabase
    .from('persons')
    .select('id, full_name')
    .eq('fraternity_id', org.fraternity_id)
  const personMap = new Map((persons ?? []).map((p) => [p.full_name, p.id]))

  // Get position map: lowercase title → position record
  const { data: positions } = await supabase
    .from('positions')
    .select('id, title, slug')
    .eq('org_id', org.id)
  const positionMap = new Map((positions ?? []).map((p) => [p.title.toLowerCase(), p]))

  // Get term definitions
  const { data: termDefs } = await supabase
    .from('term_definitions')
    .select('id, slug')
    .eq('org_id', org.id)
  const termDefMap = new Map((termDefs ?? []).map((t) => [t.slug, t.id]))

  // Get existing terms
  const { data: existingTerms } = await supabase
    .from('terms')
    .select('id, definition_id, year')
    .eq('org_id', org.id)
  const termKey = (defId: string, year: number) => `${defId}:${year}`
  const termMap = new Map(
    (existingTerms ?? []).map((t) => [termKey(t.definition_id, t.year), t.id])
  )

  // Title aliases: CSV title → DB position title
  const titleAliases: Record<string, string> = {
    'social chair': 'social chairman',
    'rush chair': 'rush chairman',
    'risk reduction chair': 'risk reduction chairman',
    'scholarship chair': 'scholarship chairman',
    'community service/philanthropy chair': 'community service chairman',
    athletics: 'athletics chairman',
  }

  // Track created positions and terms
  let positionsCreated = 0
  let termsCreated = 0
  let assignmentsCreated = 0
  let skipped = 0

  for (const row of rows) {
    const rawName = row['FULL NAME'] ?? ''
    const positionsRaw = row['Positions'] ?? ''
    if (!rawName.trim() || !positionsRaw.trim()) continue

    const fullName = cleanName(rawName)
    const personId = personMap.get(fullName)
    if (!personId) {
      continue
    }

    const entries = positionsRaw
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)

    for (const entry of entries) {
      const parsed = parsePositionEntry(entry)
      if (!parsed) {
        skipped++
        continue
      }

      // Resolve or create position
      const lookupTitle = titleAliases[parsed.title.toLowerCase()] ?? parsed.title
      let posRecord = positionMap.get(lookupTitle.toLowerCase())

      if (!posRecord) {
        // Create new position
        const slug = lookupTitle
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
        const { data: newPos } = await supabase
          .from('positions')
          .upsert(
            {
              org_id: org.id,
              title: lookupTitle,
              slug,
              type: 'committee',
              permission_level: 'officer',
              officer_selection: 'appointed',
              semester_scope: ['fall', 'spring'],
            },
            { onConflict: 'org_id,slug' }
          )
          .select()
          .single()
        if (newPos) {
          posRecord = { id: newPos.id, title: newPos.title, slug: newPos.slug }
          positionMap.set(lookupTitle.toLowerCase(), posRecord)
          positionsCreated++
        } else {
          skipped++
          continue
        }
      }

      // Resolve or create term
      const defId = termDefMap.get(parsed.termSlug)
      if (!defId) {
        skipped++
        continue
      }

      const tk = termKey(defId, parsed.year)
      let termId = termMap.get(tk)

      if (!termId) {
        const termName = `${parsed.termSlug.charAt(0).toUpperCase() + parsed.termSlug.slice(1)} ${parsed.year}`
        const startMonth = parsed.termSlug === 'fall' ? 8 : 1
        const endMonth = parsed.termSlug === 'fall' ? 12 : 5

        const { data: newTerm } = await supabase
          .from('terms')
          .upsert(
            {
              org_id: org.id,
              definition_id: defId,
              name: termName,
              year: parsed.year,
              starts_on: `${parsed.year}-${String(startMonth).padStart(2, '0')}-15`,
              ends_on: `${parsed.year}-${String(endMonth).padStart(2, '0')}-15`,
              status:
                parsed.year < 2026 || (parsed.year === 2026 && parsed.termSlug === 'fall')
                  ? 'completed'
                  : 'active',
              has_elections: true,
              has_budget: true,
              has_rollover: true,
              has_rush: true,
              officer_selection: 'elected',
            },
            { onConflict: 'org_id,definition_id,year' }
          )
          .select()
          .single()
        if (newTerm) {
          termId = newTerm.id
          termMap.set(tk, termId)
          termsCreated++
        } else {
          skipped++
          continue
        }
      }

      // Create position assignment (upsert-ish: check for duplicate)
      const { data: existing } = await supabase
        .from('position_assignments')
        .select('id')
        .eq('position_id', posRecord.id)
        .eq('person_id', personId)
        .eq('term_id', termId)
        .limit(1)
        .single()

      if (!existing) {
        await supabase.from('position_assignments').insert({
          position_id: posRecord.id,
          person_id: personId,
          org_id: org.id,
          term_id: termId,
        })
        assignmentsCreated++
      }
    }
  }

  console.log(`Positions created:   ${positionsCreated}`)
  console.log(`Terms created:       ${termsCreated}`)
  console.log(`Assignments created: ${assignmentsCreated}`)
  console.log(`Skipped:             ${skipped}`)
  console.log('\nDone!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

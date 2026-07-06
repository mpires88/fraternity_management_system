/**
 * Import roster from CSV into the database.
 *
 * Run:  npx tsx --env-file=.env.local scripts/import-roster.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── CSV Parsing ──────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanName(raw: string): { fullName: string; nickname: string | null } {
  const match = raw.match(/^(?:\d+\s+)?(.+?)\s*(?:\(Brother (.+?)\))?\s*$/)
  if (!match) return { fullName: raw.trim(), nickname: null }
  return { fullName: match[1].trim(), nickname: match[2]?.trim() ?? null }
}

function cleanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 10 ? digits : null
}

function mapStatus(
  affiliation: string,
  status: string
): {
  membershipSlug: string
  orgStatus: string
  skip: boolean
} {
  const aff = affiliation.toUpperCase()
  const st = status.toUpperCase()

  if (st === 'DEPLEDGED') return { membershipSlug: '', orgStatus: '', skip: true }
  if (aff === 'ADVISOR') return { membershipSlug: 'advisor', orgStatus: 'active', skip: false }
  if (aff === 'BOARDER')
    return {
      membershipSlug: 'boarder',
      orgStatus: st === 'INACTIVE' ? 'inactive' : 'active',
      skip: false,
    }

  switch (st) {
    case 'ACTIVE':
      return { membershipSlug: 'active_brother', orgStatus: 'active', skip: false }
    case 'ALUMNI':
      return { membershipSlug: 'alumni_brother', orgStatus: 'inactive', skip: false }
    case 'CANDIDATE':
      return { membershipSlug: 'candidate', orgStatus: 'active', skip: false }
    case 'INACTIVE':
      return { membershipSlug: 'active_brother', orgStatus: 'inactive', skip: false }
    default:
      return { membershipSlug: 'alumni_brother', orgStatus: 'inactive', skip: false }
  }
}

function parseGradYear(raw: string): number | null {
  const n = parseInt(raw, 10)
  return isNaN(n) ? null : n
}

function parseDate(raw: string): string | null {
  if (!raw || raw === 'NaN') return null
  // Handle M/D/YYYY
  const parts = raw.split('/')
  if (parts.length === 3) {
    const [m, d, y] = parts
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csv = readFileSync('test data/Contacts-Full Roster (1).csv', 'utf-8')
  const rows = parseCSV(csv)
  console.log(`Parsed ${rows.length} rows from CSV\n`)

  // Get org and fraternity
  const { data: org } = await supabase
    .from('orgs')
    .select('id, fraternity_id')
    .eq('slug', 'undergrad')
    .single()
  if (!org) throw new Error('Org not found — run seed-dev.ts first')
  const fraternityId = org.fraternity_id
  const orgId = org.id

  // Get membership type map
  const { data: types } = await supabase
    .from('membership_types')
    .select('id, slug')
    .eq('org_id', orgId)
  const typeMap = Object.fromEntries((types ?? []).map((t) => [t.slug, t.id]))

  // Create additional membership types if needed
  for (const slug of ['advisor', 'boarder']) {
    if (!typeMap[slug]) {
      const { data } = await supabase
        .from('membership_types')
        .insert({
          org_id: orgId,
          name: slug === 'advisor' ? 'Advisor' : 'Boarder',
          slug,
          access_level: slug === 'advisor' ? 'limited' : 'read_only',
          can_vote: false,
          can_hold_office: false,
          can_view_financials: slug === 'advisor',
          color: slug === 'advisor' ? '#f59e0b' : '#64748b',
          display_order: slug === 'advisor' ? 5 : 6,
        })
        .select()
        .single()
      if (data) typeMap[slug] = data.id
      console.log(`Created membership type: ${slug}`)
    }
  }

  // Delete old test members (keep admin@test.com)
  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const testEmails = [
    'jake@test.com',
    'ryan@test.com',
    'cole@test.com',
    'dylan@test.com',
    'marcus@test.com',
    'ben@test.com',
  ]
  for (const u of existingUsers?.users ?? []) {
    if (testEmails.includes(u.email ?? '')) {
      await supabase.from('org_memberships').delete().eq('person_id', u.id)
      await supabase.from('persons').delete().eq('id', u.id)
      await supabase.auth.admin.deleteUser(u.id)
    }
  }
  console.log('Cleaned up test members\n')

  // Process CSV rows
  const personMap: Record<string, string> = {} // fullName → person_id
  let imported = 0
  let skipped = 0

  for (const row of rows) {
    const rawName = row['FULL NAME'] ?? ''
    if (!rawName.trim()) {
      skipped++
      continue
    }

    const { fullName, nickname: csvNickname } = cleanName(rawName)
    const firstName = row['FIRST NAME'] ?? ''
    const lastName = row['LAST NAME'] ?? ''
    const preferredName = row['PREFERRED NAME'] ?? ''
    const brotherNickname = row['BROTHER NICKNAME'] ?? csvNickname
    const affiliation = row['Affliation'] ?? row['Affiliation'] ?? ''
    const status = row['Status'] ?? ''
    const alphaNum = row['ALPHA NUMBER copy'] ?? ''
    const badgeNum = row['BADGE NUMBER'] ?? ''
    const entryClass = row['ENTRY CLASS OF'] ?? ''
    const familyLine = row['FAMILY LINE'] ?? ''
    const bigBrother = row['BIG BROTHER'] ?? ''
    const hometown = row['HOMETOWN'] ?? ''
    const state = row['HOMETOWN STATE (IF APPLICABLE)'] ?? ''
    const country = row['HOMETOWN COUNTRY'] ?? ''
    const pledgeClass = row['PLEDGE CLASS'] ?? ''
    const phone = row['Cell Phone'] ?? ''
    const mitEmail = (row['MIT Email'] ?? '').replace(/\n/g, '').trim()
    const personalEmail = (row['Personal Email'] ?? '').replace(/\n/g, '').trim()
    const emergencyName = row['Emergency Contact'] ?? ''
    const emergencyPhone = row['Emergency Contact Phone Number'] ?? ''
    const gradYear = row['Grad Year'] ?? ''
    const initiationDate = row['Initiation Date'] ?? ''
    const memberNumber = badgeNum || alphaNum || ''

    const { membershipSlug, orgStatus, skip } = mapStatus(affiliation, status)
    if (skip) {
      skipped++
      continue
    }
    if (!typeMap[membershipSlug]) {
      skipped++
      continue
    }

    // Build email — prefer MIT email, then personal, then generate placeholder
    const email =
      mitEmail ||
      personalEmail ||
      `member-${memberNumber || fullName.toLowerCase().replace(/\s+/g, '-')}@placeholder.local`

    // Build address from hometown
    const addressParts = [hometown, state, country].filter(Boolean)
    const address = addressParts.length ? addressParts.join(', ') : null

    // Build emergency contact
    const emergencyContact = emergencyName
      ? `${emergencyName}${emergencyPhone ? ' — ' + emergencyPhone : ''}`
      : null

    // Create auth user
    let userId: string
    const existingUser = existingUsers?.users?.find((u) => u.email === email)
    if (existingUser) {
      userId = existingUser.id
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
        email_confirm: true,
      })
      if (error) {
        // Duplicate email — try with suffix
        const altEmail = `${email.split('@')[0]}+${memberNumber}@${email.split('@')[1]}`
        const { data: d2, error: e2 } = await supabase.auth.admin.createUser({
          email: altEmail,
          password: Math.random().toString(36).slice(2),
          email_confirm: true,
        })
        if (e2) {
          console.error(`  Skip ${fullName}: ${e2.message}`)
          skipped++
          continue
        }
        userId = d2.user.id
      } else {
        userId = data.user.id
      }
    }

    // Create person
    const { error: personErr } = await supabase.from('persons').upsert(
      {
        id: userId,
        fraternity_id: fraternityId,
        full_name: fullName,
        email,
        phone: cleanPhone(phone),
        personal_email: personalEmail || null,
        nickname: brotherNickname || preferredName || null,
        address,
        emergency_contact: emergencyContact,
        member_number: memberNumber || null,
        expected_grad_year: parseGradYear(entryClass) || parseGradYear(gradYear) || null,
        initiation_date: parseDate(initiationDate),
        major: null,
      },
      { onConflict: 'id' }
    )

    if (personErr) {
      console.error(`  Person error ${fullName}: ${personErr.message}`)
      skipped++
      continue
    }

    // Create membership
    await supabase.from('org_memberships').upsert(
      {
        person_id: userId,
        org_id: orgId,
        membership_type_id: typeMap[membershipSlug],
        status: orgStatus,
        joined_at: parseDate(initiationDate),
      },
      { onConflict: 'person_id,org_id' }
    )

    personMap[fullName] = userId
    imported++

    if (imported % 50 === 0) console.log(`  ${imported} imported...`)
  }

  console.log(`\nImported: ${imported}, Skipped: ${skipped}`)

  // Resolve big brother relationships
  console.log('\nResolving big brother links...')
  let linked = 0
  for (const row of rows) {
    const rawName = row['FULL NAME'] ?? ''
    const { fullName } = cleanName(rawName)
    const bigRaw = row['BIG BROTHER'] ?? ''
    if (!bigRaw || !personMap[fullName]) continue

    const { fullName: bigName } = cleanName(bigRaw)
    const bigId = personMap[bigName]
    if (!bigId) continue

    await supabase.from('persons').update({ big_id: bigId }).eq('id', personMap[fullName])
    linked++
  }
  console.log(`Linked ${linked} big brother relationships`)

  console.log('\nDone!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

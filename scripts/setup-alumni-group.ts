/**
 * Task 8.6 — create the Alumni Chapter as a third group under
 * sigma-nu / epsilon-theta (alongside chapter + snhc). Idempotent; additive
 * only — never touches roster data or the other groups.
 *
 * Creates: the group, two role types (full-access officer + limited member),
 * a Fall term definition + active Fall term, and gives officer@test.com a
 * full-access membership so the accept criterion can be exercised.
 *
 * Run:  npx tsx --env-file=.env.local scripts/setup-alumni-group.ts
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: parentOrg } = await supabase
    .from('parent_organizations')
    .select('id')
    .eq('slug', 'sigma-nu')
    .single()
  if (!parentOrg) throw new Error('parent org sigma-nu not found')

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'epsilon-theta')
    .eq('parent_organization_id', parentOrg.id)
    .single()
  if (!org) throw new Error('org epsilon-theta not found')

  // ── Group ──────────────────────────────────────────────────────────────────
  let { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('organization_id', org.id)
    .eq('slug', 'alumni')
    .maybeSingle()

  if (group) {
    console.log(`Alumni group already exists (${group.id})`)
  } else {
    const { data: created, error } = await supabase
      .from('groups')
      .insert({
        organization_id: org.id,
        name: 'Alumni Chapter',
        slug: 'alumni',
        group_type: 'alumni_chapter',
        is_primary: false,
        features: { members: true, subgroups: true },
      })
      .select('id')
      .single()
    if (error || !created) throw new Error(`group insert failed: ${error?.message}`)
    group = created
    console.log(`Created alumni group (${group.id})`)
  }

  // ── Role types ─────────────────────────────────────────────────────────────
  const roleSeeds = [
    { name: 'Alumni Officer', slug: 'alumni-officer', access_level: 'full', display_order: 1 },
    { name: 'Alumni Member', slug: 'alumni-member', access_level: 'limited', display_order: 2 },
  ]
  for (const seed of roleSeeds) {
    const { data: existing } = await supabase
      .from('role_types')
      .select('id')
      .eq('group_id', group.id)
      .eq('slug', seed.slug)
      .maybeSingle()
    if (existing) {
      console.log(`role_type ${seed.slug}: exists`)
    } else {
      const { error } = await supabase.from('role_types').insert({ group_id: group.id, ...seed })
      if (error) throw new Error(`role_type ${seed.slug} insert failed: ${error.message}`)
      console.log(`role_type ${seed.slug}: created`)
    }
  }

  // ── Term definition + active term ──────────────────────────────────────────
  let { data: termDef } = await supabase
    .from('term_definitions')
    .select('id')
    .eq('group_id', group.id)
    .maybeSingle()

  if (!termDef) {
    const { data: created, error } = await supabase
      .from('term_definitions')
      .insert({
        group_id: group.id,
        name: 'Fall',
        slug: 'fall',
        start_month: 7,
        start_day: 1,
        end_month: 12,
        end_day: 31,
        ordinal: 1,
      })
      .select('id')
      .single()
    if (error || !created) throw new Error(`term_definition insert failed: ${error?.message}`)
    termDef = created
    console.log('term_definition Fall: created')
  } else {
    console.log('term_definition: exists')
  }

  const { data: activeTerm } = await supabase
    .from('terms')
    .select('id, name')
    .eq('group_id', group.id)
    .eq('status', 'active')
    .maybeSingle()

  if (activeTerm) {
    console.log(`active term exists: ${activeTerm.name}`)
  } else {
    const year = new Date().getFullYear()
    const { error } = await supabase.from('terms').insert({
      group_id: group.id,
      definition_id: termDef.id,
      name: `Fall ${year}`,
      year,
      starts_on: `${year}-07-01`,
      ends_on: `${year}-12-31`,
      status: 'active',
      has_elections: true,
      has_budget: true,
      has_rollover: true,
      has_rush: false,
      officer_selection: 'elected',
    })
    if (error) throw new Error(`term insert failed: ${error.message}`)
    console.log(`active term Fall ${year}: created`)
  }

  // ── officer@test.com gets a full-access alumni membership ──────────────────
  const { data: officerPerson } = await supabase
    .from('persons')
    .select('id')
    .eq('school_email', 'officer@test.com')
    .single()
  if (!officerPerson) throw new Error('officer@test.com persona not found — run seed-dev.ts first')

  const { data: fullRole } = await supabase
    .from('role_types')
    .select('id')
    .eq('group_id', group.id)
    .eq('access_level', 'full')
    .single()
  const { data: activeStatus } = await supabase
    .from('status_definitions')
    .select('id')
    .eq('slug', 'active')
    .is('group_id', null)
    .single()
  if (!fullRole || !activeStatus) throw new Error('role/status lookup failed')

  const { data: existingMembership } = await supabase
    .from('group_memberships')
    .select('id')
    .eq('person_id', officerPerson.id)
    .eq('group_id', group.id)
    .is('ended_at', null)
    .maybeSingle()

  if (existingMembership) {
    console.log('officer@test.com alumni membership: exists')
  } else {
    const { error } = await supabase.from('group_memberships').insert({
      person_id: officerPerson.id,
      group_id: group.id,
      role_type_id: fullRole.id,
      status_id: activeStatus.id,
      joined_at: new Date().toISOString().split('T')[0],
    })
    if (error) throw new Error(`membership insert failed: ${error.message}`)
    console.log('officer@test.com alumni membership: created')
  }

  console.log('\nDone. URL: /sigma-nu/epsilon-theta/alumni/dashboard')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Migrate from membership_types to affiliation_types + status_definitions.
 * Maps existing memberships to the new model.
 *
 * Run:  npx tsx --env-file=.env.local scripts/migrate-to-affiliation-model.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // Get orgs
  const { data: orgs } = await supabase.from('orgs').select('id, name, slug')
  const etOrg = orgs!.find((o) => o.slug === 'undergrad')!
  const snhcOrg = orgs!.find((o) => o.slug === 'snhc')!

  // ── 1. Create affiliation types for Epsilon Theta ─────────────────────────

  console.log('Creating affiliation types for Epsilon Theta...')
  const etAffiliations = [
    {
      name: 'Member',
      slug: 'member',
      access_level: 'full',
      can_vote: true,
      can_hold_office: true,
      can_attend_events: true,
      can_view_roster: true,
      can_view_financials: true,
      can_submit_expenses: true,
      can_view_minutes: true,
      can_speak_at_meetings: true,
      can_view_documents: true,
      color: '#4f46e5',
      display_order: 1,
      is_default: true,
    },
    {
      name: 'Advisor',
      slug: 'advisor',
      access_level: 'limited',
      can_vote: false,
      can_hold_office: false,
      can_attend_events: true,
      can_view_roster: true,
      can_view_financials: true,
      can_submit_expenses: false,
      can_view_minutes: true,
      can_speak_at_meetings: true,
      can_view_documents: true,
      color: '#f59e0b',
      display_order: 2,
    },
    {
      name: 'Boarder',
      slug: 'boarder',
      access_level: 'read_only',
      can_vote: false,
      can_hold_office: false,
      can_attend_events: true,
      can_view_roster: true,
      can_view_financials: false,
      can_submit_expenses: false,
      can_view_minutes: false,
      can_speak_at_meetings: false,
      can_view_documents: false,
      color: '#64748b',
      display_order: 3,
    },
    {
      name: 'Parent/Guardian',
      slug: 'parent_guardian',
      access_level: 'read_only',
      can_vote: false,
      can_hold_office: false,
      can_attend_events: false,
      can_view_roster: false,
      can_view_financials: false,
      can_submit_expenses: false,
      can_view_minutes: false,
      can_speak_at_meetings: false,
      can_view_documents: false,
      color: '#d97706',
      display_order: 4,
    },
    {
      name: 'Spouse/Partner',
      slug: 'spouse_partner',
      access_level: 'read_only',
      can_vote: false,
      can_hold_office: false,
      can_attend_events: false,
      can_view_roster: false,
      can_view_financials: false,
      can_submit_expenses: false,
      can_view_minutes: false,
      can_speak_at_meetings: false,
      can_view_documents: false,
      color: '#db2777',
      display_order: 5,
    },
  ] as const

  const etAffMap: Record<string, string> = {}
  for (const a of etAffiliations) {
    const { data } = await supabase
      .from('affiliation_types')
      .upsert({ org_id: etOrg.id, ...a }, { onConflict: 'org_id,slug' })
      .select()
      .single()
    if (data) etAffMap[a.slug] = data.id
  }
  console.log(`  Created ${Object.keys(etAffMap).length} affiliation types`)

  // ── 2. Create extended statuses for Epsilon Theta ─────────────────────────

  console.log('Creating extended statuses for Epsilon Theta...')
  const etStatuses = [
    {
      name: 'Alumni Brother',
      slug: 'alumni_brother',
      description: 'Graduated, reduced access',
      override_access_level: 'read_only',
      override_can_vote: false,
      override_can_hold_office: false,
      override_can_submit_expenses: false,
      override_can_view_financials: false,
      color: '#a855f7',
      display_order: 10,
    },
    {
      name: 'Probated',
      slug: 'probated',
      description: 'Restricted but still participating',
      override_can_vote: false,
      override_can_hold_office: false,
      color: '#eab308',
      display_order: 11,
    },
    {
      name: 'Suspended',
      slug: 'suspended',
      description: 'Honor board process, active members',
      override_access_level: 'none',
      override_can_vote: false,
      override_can_hold_office: false,
      override_can_attend_events: false,
      override_can_view_roster: false,
      override_can_view_financials: false,
      override_can_submit_expenses: false,
      override_can_view_minutes: false,
      override_can_speak_at_meetings: false,
      override_can_view_documents: false,
      color: '#dc2626',
      display_order: 12,
    },
    {
      name: 'Alumni Suspended',
      slug: 'alumni_suspended',
      description: 'Administrative process, post-graduation',
      override_access_level: 'none',
      override_can_vote: false,
      override_can_hold_office: false,
      override_can_attend_events: false,
      override_can_view_roster: false,
      override_can_view_financials: false,
      override_can_submit_expenses: false,
      override_can_view_minutes: false,
      override_can_speak_at_meetings: false,
      override_can_view_documents: false,
      color: '#991b1b',
      display_order: 13,
    },
  ] as const

  for (const s of etStatuses) {
    await supabase.from('status_definitions').upsert(
      { org_id: etOrg.id, is_base: false, ...s },
      {
        onConflict: 'status_definitions_org_slug_idx',
      }
    )
  }
  console.log(`  Created ${etStatuses.length} extended statuses`)

  // ── 3. Create affiliation types for SNHC ──────────────────────────────────

  console.log('Creating affiliation types for SNHC...')
  const snhcAffiliations = [
    {
      name: 'Director',
      slug: 'director',
      access_level: 'full',
      can_vote: true,
      can_hold_office: true,
      can_view_financials: true,
      can_submit_expenses: true,
      color: '#4f46e5',
      display_order: 1,
      is_default: true,
    },
    {
      name: 'Officer',
      slug: 'officer',
      access_level: 'full',
      can_vote: true,
      can_hold_office: true,
      can_view_financials: true,
      can_submit_expenses: true,
      color: '#0891b2',
      display_order: 2,
    },
    {
      name: 'Member',
      slug: 'member',
      access_level: 'limited',
      can_vote: false,
      can_hold_office: false,
      can_view_financials: false,
      can_submit_expenses: false,
      color: '#6b7280',
      display_order: 3,
    },
  ] as const

  const snhcAffMap: Record<string, string> = {}
  for (const a of snhcAffiliations) {
    const { data } = await supabase
      .from('affiliation_types')
      .upsert({ org_id: snhcOrg.id, ...a }, { onConflict: 'org_id,slug' })
      .select()
      .single()
    if (data) snhcAffMap[a.slug] = data.id
  }
  console.log(`  Created ${Object.keys(snhcAffMap).length} affiliation types`)

  // ── 4. Get status IDs for mapping ─────────────────────────────────────────

  const { data: allStatuses } = await supabase.from('status_definitions').select('id, slug, org_id')
  const statusMap: Record<string, string> = {}
  for (const s of allStatuses ?? []) {
    const key = s.org_id ? `${s.org_id}:${s.slug}` : s.slug
    statusMap[key] = s.id
  }

  // ── 5. Migrate existing org_memberships ───────────────────────────────────

  console.log('\nMigrating existing memberships...')

  // Get old membership_types for mapping
  const { data: oldTypes } = await supabase.from('membership_types').select('id, slug, org_id')
  const oldTypeMap: Record<string, { slug: string; org_id: string }> = {}
  for (const t of oldTypes ?? []) {
    oldTypeMap[t.id] = { slug: t.slug, org_id: t.org_id }
  }

  // Mapping: old membership_type slug → { affiliation_slug, status_slug }
  const etMapping: Record<string, { aff: string; status: string }> = {
    active_brother: { aff: 'member', status: 'active' },
    candidate: { aff: 'member', status: 'candidate' },
    away_brother: { aff: 'member', status: 'away' },
    alumni_brother: { aff: 'member', status: `${etOrg.id}:alumni_brother` },
    advisor: { aff: 'advisor', status: 'active' },
    boarder: { aff: 'boarder', status: 'active' },
    parent_guardian: { aff: 'parent_guardian', status: 'active' },
    spouse_partner: { aff: 'spouse_partner', status: 'active' },
  }

  const snhcMapping: Record<string, { aff: string; status: string }> = {
    director: { aff: 'director', status: 'active' },
    officer: { aff: 'officer', status: 'active' },
    member: { aff: 'member', status: 'active' },
  }

  const { data: memberships } = await supabase
    .from('org_memberships')
    .select('id, membership_type_id, org_id, status')

  let migrated = 0
  let skipped = 0

  for (const m of memberships ?? []) {
    const oldType = oldTypeMap[m.membership_type_id]
    if (!oldType) {
      skipped++
      continue
    }

    const isET = m.org_id === etOrg.id
    const mapping = isET ? etMapping[oldType.slug] : snhcMapping[oldType.slug]
    if (!mapping) {
      skipped++
      continue
    }

    const affMap = isET ? etAffMap : snhcAffMap
    const affId = affMap[mapping.aff]
    if (!affId) {
      skipped++
      continue
    }

    // Determine status: use old status field if it maps to an extended status,
    // otherwise use the mapping default
    let statusKey = mapping.status
    const oldStatus = m.status
    if (oldStatus && oldStatus !== 'active') {
      // Check if old status maps to an extended status
      const extKey = `${m.org_id}:${oldStatus}`
      if (statusMap[extKey]) statusKey = extKey
      else if (statusMap[oldStatus]) statusKey = oldStatus
    }

    const statusId = statusMap[statusKey]
    if (!statusId) {
      skipped++
      continue
    }

    await supabase
      .from('org_memberships')
      .update({ affiliation_type_id: affId, status_id: statusId })
      .eq('id', m.id)

    migrated++
  }

  console.log(`  Migrated: ${migrated}`)
  console.log(`  Skipped: ${skipped}`)

  console.log('\nDone!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

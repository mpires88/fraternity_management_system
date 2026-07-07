/**
 * Dev seed script — v3 schema.
 *
 * Idempotently creates three test personas in the existing sigma-nu / epsilon-theta
 * org. Never creates orgs/groups or modifies roster rows.
 *
 * Run:  npx tsx --env-file=.env.local scripts/seed-dev.ts
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

const PASSWORD = 'password123'

const PERSONAS = [
  { email: 'officer@test.com', name: 'Test Officer', needsMembership: 'full' },
  { email: 'member@test.com', name: 'Test Member', needsMembership: 'limited' },
  { email: 'outsider@test.com', name: 'Test Outsider', needsMembership: null },
] as const

async function ensureAuthUser(email: string): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers()
  const existing = list?.users?.find((u) => u.email === email)
  if (existing) return existing.id

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`)
  return data.user.id
}

async function main() {
  console.log('Seeding dev personas (v3 schema)...\n')

  // ── Look up existing org structure ────────────────────────────────────────
  const { data: parentOrg } = await supabase
    .from('parent_organizations')
    .select('id')
    .eq('slug', 'sigma-nu')
    .single()
  if (!parentOrg) throw new Error('parent_organizations "sigma-nu" not found — is the DB seeded?')

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'epsilon-theta')
    .eq('parent_organization_id', parentOrg.id)
    .single()
  if (!org) throw new Error('organizations "epsilon-theta" not found')

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('organization_id', org.id)
    .eq('group_type', 'chapter')
    .single()
  if (!group) throw new Error('chapter group not found')
  console.log(`Found: sigma-nu / epsilon-theta / chapter (${group.id})`)

  // ── Look up role types by access_level ────────────────────────────────────
  const { data: roleTypes } = await supabase
    .from('role_types')
    .select('id, slug, access_level')
    .eq('group_id', group.id)

  const fullRole = roleTypes?.find((r) => r.access_level === 'full')
  const limitedRole = roleTypes?.find((r) => r.access_level === 'limited')
  if (!fullRole) throw new Error('No role_type with access_level = "full" found')
  if (!limitedRole) throw new Error('No role_type with access_level = "limited" found')
  console.log(`Roles: full → ${fullRole.slug}, limited → ${limitedRole.slug}`)

  // ── Look up the "active" status_definition ────────────────────────────────
  const { data: statusDefs } = await supabase
    .from('status_definitions')
    .select('id, slug')
    .or(`group_id.eq.${group.id},group_id.is.null`)

  const activeStatus = statusDefs?.find((s) => s.slug === 'active')
  if (!activeStatus) throw new Error('No status_definition with slug = "active" found')

  // ── Create personas ───────────────────────────────────────────────────────
  for (const persona of PERSONAS) {
    const userId = await ensureAuthUser(persona.email)
    console.log(`\n${persona.name} (${persona.email}): auth ${userId}`)

    // Upsert person
    const { error: personErr } = await supabase.from('persons').upsert(
      {
        id: userId,
        full_name: persona.name,
        personal_email: persona.email,
        school_email: persona.email,
      },
      { onConflict: 'id' }
    )
    if (personErr) throw new Error(`persons upsert failed: ${personErr.message}`)
    console.log('  person: ok')

    if (persona.needsMembership) {
      const roleId = persona.needsMembership === 'full' ? fullRole.id : limitedRole.id

      // Check for existing membership
      const { data: existing } = await supabase
        .from('group_memberships')
        .select('id')
        .eq('person_id', userId)
        .eq('group_id', group.id)
        .is('ended_at', null)
        .limit(1)
        .maybeSingle()

      if (existing) {
        // Update role if needed
        await supabase
          .from('group_memberships')
          .update({ role_type_id: roleId, status_id: activeStatus.id })
          .eq('id', existing.id)
        console.log(`  membership: updated (${persona.needsMembership})`)
      } else {
        const { error: memErr } = await supabase.from('group_memberships').insert({
          person_id: userId,
          group_id: group.id,
          role_type_id: roleId,
          status_id: activeStatus.id,
          joined_at: '2024-08-20',
        })
        if (memErr) throw new Error(`group_memberships insert failed: ${memErr.message}`)
        console.log(`  membership: created (${persona.needsMembership})`)
      }
    } else {
      console.log('  membership: none (outsider)')
    }
  }

  // ── Ensure a current term exists ──────────────────────────────────────────
  const { data: activeTerm } = await supabase
    .from('terms')
    .select('id, name')
    .eq('group_id', group.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (activeTerm) {
    console.log(`\nActive term already exists: ${activeTerm.name}`)
  } else {
    // Look for a term definition to create from
    const { data: termDef } = await supabase
      .from('term_definitions')
      .select(
        'id, name, start_month, start_day, end_month, end_day, has_elections, has_budget, has_rollover, has_rush, officer_selection'
      )
      .eq('group_id', group.id)
      .order('ordinal')
      .limit(1)
      .maybeSingle()

    if (termDef) {
      const year = new Date().getFullYear()
      const startsOn = `${year}-${String(termDef.start_month).padStart(2, '0')}-${String(termDef.start_day).padStart(2, '0')}`
      const endsYear = termDef.end_month < termDef.start_month ? year + 1 : year
      const endsOn = `${endsYear}-${String(termDef.end_month).padStart(2, '0')}-${String(termDef.end_day).padStart(2, '0')}`

      const { error: termErr } = await supabase.from('terms').insert({
        group_id: group.id,
        definition_id: termDef.id,
        name: `${termDef.name} ${year}`,
        year,
        starts_on: startsOn,
        ends_on: endsOn,
        status: 'active',
        has_elections: termDef.has_elections ?? true,
        has_budget: termDef.has_budget ?? true,
        has_rollover: termDef.has_rollover ?? true,
        has_rush: termDef.has_rush ?? false,
        officer_selection: termDef.officer_selection ?? 'elected',
      })
      if (termErr) throw new Error(`term insert failed: ${termErr.message}`)
      console.log(`\nCreated active term: ${termDef.name} ${year}`)
    } else {
      console.log(
        '\nNo term definitions found — skipping term creation. Create one in admin first.'
      )
    }
  }

  console.log('\n--- Done! ---')
  console.log('Logins (all password123):')
  console.log('  officer@test.com  — full-access, sees admin/settings')
  console.log('  member@test.com   — limited, sees own data')
  console.log('  outsider@test.com — no membership, sees nothing')
  console.log('URL: /sigma-nu/epsilon-theta/chapter/dashboard')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

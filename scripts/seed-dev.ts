/**
 * Seed script — creates a test fraternity, org, membership types,
 * positions, terms, a test user + person, and an org membership.
 *
 * Run:  npx tsx scripts/seed-dev.ts
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

const TEST_EMAIL = 'admin@test.com'
const TEST_PASSWORD = 'password123'

async function main() {
  console.log('Seeding dev data...\n')

  // 1. Create or find auth user
  let userId: string
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users?.find((u) => u.email === TEST_EMAIL)

  if (existing) {
    userId = existing.id
    console.log(`Auth user exists: ${TEST_EMAIL} (${userId})`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user.id
    console.log(`Created auth user: ${TEST_EMAIL} (${userId})`)
  }

  // 2. Create fraternity
  const { data: fraternity } = await supabase
    .from('fraternities')
    .upsert({ name: 'Sigma Nu', slug: 'sigma-nu' }, { onConflict: 'slug' })
    .select()
    .single()
  console.log(`Fraternity: ${fraternity!.name} (${fraternity!.id})`)

  // 3. Create org (undergrad chapter)
  const { data: org } = await supabase
    .from('orgs')
    .upsert(
      {
        fraternity_id: fraternity!.id,
        name: 'Epsilon Theta Chapter',
        slug: 'undergrad',
        org_type: 'chapter',
        features: {
          members: true,
          announcements: true,
          documents: true,
          meetings: true,
          events: true,
          budget: true,
          dues: true,
          elections: true,
          voting: true,
          house: true,
          rush: true,
          tasks: true,
          subgroups: true,
        },
      },
      { onConflict: 'fraternity_id,slug' }
    )
    .select()
    .single()
  console.log(`Org: ${org!.name} (${org!.id})`)

  // 4. Create term definitions (semester system)
  const { data: fallDef } = await supabase
    .from('term_definitions')
    .upsert(
      {
        org_id: org!.id,
        name: 'Fall',
        slug: 'fall',
        ordinal: 1,
        start_month: 8,
        start_day: 15,
        end_month: 12,
        end_day: 15,
        has_rush: true,
      },
      { onConflict: 'org_id,slug' }
    )
    .select()
    .single()

  const { data: springDef } = await supabase
    .from('term_definitions')
    .upsert(
      {
        org_id: org!.id,
        name: 'Spring',
        slug: 'spring',
        ordinal: 2,
        start_month: 1,
        start_day: 10,
        end_month: 5,
        end_day: 15,
        has_rush: true,
      },
      { onConflict: 'org_id,slug' }
    )
    .select()
    .single()
  console.log(`Term definitions: Fall, Spring`)

  // 5. Create current term (Spring 2026)
  const { data: currentTerm } = await supabase
    .from('terms')
    .upsert(
      {
        org_id: org!.id,
        definition_id: springDef!.id,
        name: 'Spring 2026',
        year: 2026,
        starts_on: '2026-01-10',
        ends_on: '2026-05-15',
        status: 'active',
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
  console.log(`Current term: ${currentTerm!.name}`)

  // 6. Create membership types (Sigma Nu standard)
  const membershipTypes = [
    {
      name: 'Active Brother',
      slug: 'active_brother',
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
      name: 'Candidate',
      slug: 'candidate',
      access_level: 'limited',
      can_vote: true,
      can_hold_office: false,
      can_view_financials: false,
      can_submit_expenses: false,
      color: '#0891b2',
      display_order: 2,
    },
    {
      name: 'Away Brother',
      slug: 'away_brother',
      access_level: 'limited',
      can_vote: false,
      can_hold_office: false,
      can_view_financials: false,
      can_submit_expenses: false,
      color: '#6b7280',
      display_order: 3,
    },
    {
      name: 'Alumni Brother',
      slug: 'alumni_brother',
      access_level: 'read_only',
      can_vote: false,
      can_hold_office: false,
      can_view_financials: false,
      can_submit_expenses: false,
      color: '#a855f7',
      display_order: 4,
    },
  ] as const

  const insertedTypes: Record<string, string> = {}
  for (const mt of membershipTypes) {
    const { data } = await supabase
      .from('membership_types')
      .upsert({ org_id: org!.id, ...mt }, { onConflict: 'org_id,slug' })
      .select()
      .single()
    insertedTypes[mt.slug] = data!.id
  }
  console.log(`Membership types: ${membershipTypes.length} created`)

  // 7. Create positions (Sigma Nu exec)
  const { data: sysRoles } = await supabase.from('system_position_roles').select('id, slug')
  const roleMap = Object.fromEntries((sysRoles ?? []).map((r) => [r.slug, r.id]))

  const positions = [
    {
      title: 'Commander',
      slug: 'commander',
      system_role_id: roleMap.presiding_officer,
      type: 'exec',
      permission_level: 'exec',
      officer_selection: 'elected',
      has_budget: true,
      is_presiding_officer: true,
      display_order: 1,
    },
    {
      title: 'Lieutenant Commander',
      slug: 'lt_commander',
      system_role_id: roleMap.vice_president,
      type: 'exec',
      permission_level: 'exec',
      officer_selection: 'elected',
      display_order: 2,
    },
    {
      title: 'Treasurer',
      slug: 'treasurer',
      system_role_id: roleMap.treasurer,
      type: 'exec',
      permission_level: 'exec',
      officer_selection: 'elected',
      has_budget: true,
      display_order: 3,
    },
    {
      title: 'Recorder',
      slug: 'recorder',
      system_role_id: roleMap.secretary,
      type: 'exec',
      permission_level: 'exec',
      officer_selection: 'elected',
      display_order: 4,
    },
    {
      title: 'Marshal',
      slug: 'marshal',
      type: 'exec',
      permission_level: 'exec',
      officer_selection: 'elected',
      display_order: 5,
    },
    {
      title: 'Rush Chairman',
      slug: 'rush_chairman',
      system_role_id: roleMap.rush_chair,
      type: 'committee',
      permission_level: 'officer',
      officer_selection: 'elected',
      has_budget: true,
      display_order: 6,
    },
    {
      title: 'House Manager',
      slug: 'house_manager',
      system_role_id: roleMap.house_manager,
      type: 'house',
      permission_level: 'officer',
      officer_selection: 'elected',
      has_budget: true,
      display_order: 7,
    },
    {
      title: 'Social Chairman',
      slug: 'social_chairman',
      type: 'committee',
      permission_level: 'officer',
      officer_selection: 'elected',
      has_budget: true,
      display_order: 8,
    },
  ]

  for (const pos of positions) {
    await supabase
      .from('positions')
      .upsert(
        { org_id: org!.id, semester_scope: ['fall', 'spring'], ...pos },
        { onConflict: 'org_id,slug' }
      )
  }
  console.log(`Positions: ${positions.length} created`)

  // 8. Create person (admin user) and platform_admin
  await supabase
    .from('platform_admins')
    .upsert({ id: userId, email: TEST_EMAIL }, { onConflict: 'id' })

  await supabase.from('persons').upsert(
    {
      id: userId,
      fraternity_id: fraternity!.id,
      full_name: 'Matt Pires',
      email: TEST_EMAIL,
      major: 'Computer Science',
      expected_grad_year: 2027,
    },
    { onConflict: 'id' }
  )
  console.log(`Person: Matt Pires (${userId})`)

  // 9. Create org membership
  await supabase.from('org_memberships').upsert(
    {
      person_id: userId,
      org_id: org!.id,
      membership_type_id: insertedTypes.active_brother,
      status: 'active',
      joined_at: '2024-08-20',
    },
    { onConflict: 'person_id,org_id' }
  )
  console.log(`Membership: Active Brother in ${org!.name}`)

  // 10. Add a few more members for the roster
  const testMembers = [
    { name: 'Jake Thompson', email: 'jake@test.com', type: 'active_brother', status: 'active' },
    { name: 'Ryan Mitchell', email: 'ryan@test.com', type: 'active_brother', status: 'active' },
    { name: 'Cole Anderson', email: 'cole@test.com', type: 'active_brother', status: 'probated' },
    { name: 'Dylan Park', email: 'dylan@test.com', type: 'candidate', status: 'active' },
    { name: 'Marcus Williams', email: 'marcus@test.com', type: 'away_brother', status: 'away' },
    { name: 'Ben Taylor', email: 'ben@test.com', type: 'alumni_brother', status: 'inactive' },
  ]

  for (const m of testMembers) {
    // Create auth user
    let memberId: string
    const existingMember = existingUsers?.users?.find((u) => u.email === m.email)
    if (existingMember) {
      memberId = existingMember.id
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: m.email,
        password: TEST_PASSWORD,
        email_confirm: true,
      })
      if (error) {
        console.error(`  Failed to create ${m.email}: ${error.message}`)
        continue
      }
      memberId = data.user.id
    }

    // Create person
    await supabase
      .from('persons')
      .upsert(
        { id: memberId, fraternity_id: fraternity!.id, full_name: m.name, email: m.email },
        { onConflict: 'id' }
      )

    // Create membership
    await supabase.from('org_memberships').upsert(
      {
        person_id: memberId,
        org_id: org!.id,
        membership_type_id: insertedTypes[m.type],
        status: m.status,
        joined_at: '2024-08-20',
      },
      { onConflict: 'person_id,org_id' }
    )
  }
  console.log(`Test members: ${testMembers.length} created`)

  console.log('\n--- Done! ---')
  console.log(`Login:    ${TEST_EMAIL} / ${TEST_PASSWORD}`)
  console.log(`URL:      /sigma-nu/undergrad/dashboard`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

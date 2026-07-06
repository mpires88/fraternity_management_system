/**
 * Migrate family_line and pledge_class data from persons into subgroups.
 *
 * Run:  npx tsx --env-file=.env.local scripts/migrate-to-subgroups.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data: org } = await supabase.from('orgs').select('id').eq('slug', 'undergrad').single()
  if (!org) throw new Error('Org not found')

  // ── Family Lines ──────────────────────────────────────────────────────────

  console.log('Creating family line subgroups...')

  const { data: persons } = await supabase.from('persons').select('id, family_line, big_id')

  // Get unique family lines
  const familyLines = [
    ...new Set((persons ?? []).map((p) => p.family_line).filter(Boolean)),
  ] as string[]

  console.log(`  Found ${familyLines.length} family lines: ${familyLines.join(', ')}`)

  const familySubgroupMap: Record<string, string> = {}

  for (const line of familyLines) {
    const slug = line
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    const { data } = await supabase
      .from('subgroups')
      .upsert(
        {
          org_id: org.id,
          name: line,
          slug: `family_${slug}`,
          subgroup_type: 'family_line',
          membership_type: 'automatic',
          is_locked: true,
          can_rename: false,
        },
        { onConflict: 'org_id,slug' }
      )
      .select()
      .single()
    if (data) familySubgroupMap[line] = data.id
  }

  // Add persons to their family line subgroups
  let familyMembersAdded = 0
  for (const person of persons ?? []) {
    if (!person.family_line || !familySubgroupMap[person.family_line]) continue

    await supabase.from('subgroup_members').upsert(
      {
        subgroup_id: familySubgroupMap[person.family_line],
        person_id: person.id,
        role: 'member',
        join_type: 'automatic',
      },
      { onConflict: 'subgroup_id,person_id' }
    )
    familyMembersAdded++
  }
  console.log(`  Added ${familyMembersAdded} members to family line subgroups`)

  // ── Pledge Classes ────────────────────────────────────────────────────────

  console.log('\nCreating pledge class subgroups...')

  const { data: pledgeClasses } = await supabase
    .from('pledge_classes')
    .select('id, name, org_id')
    .eq('org_id', org.id)

  if (pledgeClasses && pledgeClasses.length > 0) {
    for (const pc of pledgeClasses) {
      const slug = `pledge_${pc.name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')}`
      await supabase.from('subgroups').upsert(
        {
          org_id: org.id,
          name: pc.name,
          slug,
          subgroup_type: 'pledge_class',
          pledge_class_id: pc.id,
          membership_type: 'automatic',
          is_locked: true,
        },
        { onConflict: 'org_id,slug' }
      )
    }
    console.log(`  Created ${pledgeClasses.length} pledge class subgroups`)

    // Pledge class membership via subgroup_members handled separately
  }

  // ── Now drop family_line from persons (data migrated to subgroups) ────────

  console.log('\nDone!')
  console.log('Family line and pledge class data migrated to subgroups.')
  console.log('The family_line column on persons can now be dropped in a future migration.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

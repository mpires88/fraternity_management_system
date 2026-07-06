/**
 * Migrates legacy emergency_contact text fields into person_contacts records.
 * Creates auth users + person records + org memberships for each contact.
 *
 * Run:  npx tsx --env-file=.env.local scripts/migrate-emergency-contacts.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // Get org
  const { data: org } = await supabase
    .from('orgs')
    .select('id, fraternity_id')
    .eq('slug', 'undergrad')
    .single()
  if (!org) throw new Error('Org not found')

  // Ensure parent/guardian membership type exists
  const { data: existingTypes } = await supabase
    .from('membership_types')
    .select('id, slug')
    .eq('org_id', org.id)
  const typeMap = new Map((existingTypes ?? []).map((t) => [t.slug, t.id]))

  const affiliationTypes = [
    {
      slug: 'parent_guardian',
      name: 'Parent/Guardian',
      access_level: 'read_only',
      color: '#d97706',
      display_order: 10,
    },
    {
      slug: 'spouse_partner',
      name: 'Spouse/Partner',
      access_level: 'read_only',
      color: '#db2777',
      display_order: 11,
    },
  ] as const

  for (const at of affiliationTypes) {
    if (!typeMap.has(at.slug)) {
      const { data } = await supabase
        .from('membership_types')
        .insert({
          org_id: org.id,
          name: at.name,
          slug: at.slug,
          access_level: at.access_level,
          can_vote: false,
          can_hold_office: false,
          can_attend_events: false,
          can_view_roster: false,
          can_view_financials: false,
          can_submit_expenses: false,
          can_view_minutes: false,
          can_speak_at_meetings: false,
          can_view_documents: false,
          color: at.color,
          display_order: at.display_order,
        })
        .select()
        .single()
      if (data) typeMap.set(at.slug, data.id)
      console.log(`Created membership type: ${at.name}`)
    }
  }

  const parentTypeId = typeMap.get('parent_guardian')!

  // Find all persons with emergency contact info
  const { data: members } = await supabase
    .from('persons')
    .select('id, fraternity_id, emergency_contact_name, emergency_contact_phone')
    .eq('fraternity_id', org.fraternity_id)
    .not('emergency_contact_name', 'is', null)

  console.log(`\nFound ${(members ?? []).length} members with emergency contacts\n`)

  let created = 0
  let skipped = 0

  for (const member of members ?? []) {
    const ecName = member.emergency_contact_name?.trim()
    if (!ecName) {
      skipped++
      continue
    }

    const ecPhone = member.emergency_contact_phone?.trim()

    // Generate a placeholder email for the contact
    const slug = ecName
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '')
    const email = `contact-${slug}-${member.id.slice(0, 8)}@contact.placeholder.local`

    // Check if this contact already exists as a person_contact
    const { data: existingContact } = await supabase
      .from('person_contacts')
      .select('id')
      .eq('person_id', member.id)
      .limit(1)
      .single()

    if (existingContact) {
      skipped++
      continue
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      email_confirm: true,
    })

    if (authError) {
      console.error(`  Skip ${ecName}: ${authError.message}`)
      skipped++
      continue
    }

    const contactUserId = authData.user.id

    // Parse name into first/last
    const nameParts = ecName.split(/\s+/)
    const firstName = nameParts[0]
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

    // Create person record
    await supabase.from('persons').insert({
      id: contactUserId,
      fraternity_id: org.fraternity_id,
      full_name: ecName,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: ecPhone,
    })

    // Create org membership
    await supabase.from('org_memberships').insert({
      person_id: contactUserId,
      org_id: org.id,
      membership_type_id: parentTypeId,
      status: 'active',
    })

    // Create person_contact link
    await supabase.from('person_contacts').insert({
      person_id: member.id,
      contact_person_id: contactUserId,
      relationship: 'parent',
      is_emergency: true,
      is_primary: true,
    })

    created++
    if (created % 10 === 0) console.log(`  ${created} contacts created...`)
  }

  console.log(`\nCreated: ${created}`)
  console.log(`Skipped: ${skipped}`)
  console.log('Done!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

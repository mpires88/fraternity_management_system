'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type InviteInput = {
  school_email: string
  full_name: string
  role_type_id: string
  groupId: string
  parentSlug: string | null
  orgSlug: string
}

export async function inviteMember(input: InviteInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { school_email, full_name, role_type_id, groupId, parentSlug, orgSlug } = input

  if (!school_email || !school_email.includes('@')) {
    return { success: false, error: 'Valid email required' }
  }

  // Check if person already exists by email (platform-level)
  const { data: existingPerson } = await supabase
    .from('persons')
    .select('id')
    .eq('school_email', school_email)
    .limit(1)
    .single()

  let personId: string

  if (existingPerson) {
    personId = existingPerson.id

    const { data: existingMembership } = await supabase
      .from('group_memberships')
      .select('id')
      .eq('person_id', personId)
      .eq('group_id', groupId)
      .is('ended_at', null)
      .limit(1)
      .single()

    if (existingMembership) {
      return { success: false, error: 'This person is already a member of this org' }
    }
  } else {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: school_email,
      password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      email_confirm: true,
    })

    if (authError) {
      return { success: false, error: `Failed to create account: ${authError.message}` }
    }

    personId = authData.user.id

    const { error: personError } = await admin
      .from('persons')
      .insert({ id: personId, full_name, school_email })

    if (personError) {
      return { success: false, error: `Failed to create person: ${personError.message}` }
    }
  }

  // Get the active status ID
  const { data: activeStatus } = await supabase
    .from('status_definitions')
    .select('id')
    .eq('slug', 'active')
    .is('group_id', null)
    .single()

  const { error: membershipError } = await supabase.from('group_memberships').insert({
    person_id: personId,
    group_id: groupId,
    role_type_id,
    status_id: activeStatus?.id,
    joined_at: new Date().toISOString().split('T')[0],
  })

  if (membershipError) {
    return { success: false, error: `Failed to create membership: ${membershipError.message}` }
  }

  const basePath = parentSlug ? `${parentSlug ? '/' + parentSlug : ''}/${orgSlug}` : `/${orgSlug}`
  revalidatePath(`${basePath}/members`)
  revalidatePath(`${basePath}/dashboard`)

  return { success: true }
}

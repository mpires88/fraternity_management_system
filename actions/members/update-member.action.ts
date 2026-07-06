'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type UpdateMemberInput = {
  personId: string
  groupId: string
  parentSlug: string | null
  orgSlug: string
  // Person fields
  full_name?: string
  first_name?: string | null
  last_name?: string | null
  preferred_name?: string | null
  nickname?: string | null
  phone?: string | null
  personal_email?: string | null
  school_email?: string | null
  street_address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  major?: string | null
  bio?: string | null
  // Membership fields
  role_type_id?: string
  status_id?: string
}

export async function updateMember(input: UpdateMemberInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { personId, groupId, parentSlug, orgSlug, role_type_id, status_id, ...personFields } = input

  // Update person record (strip undefined keys)
  const personUpdate: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(personFields)) {
    if (v !== undefined) personUpdate[k] = v
  }

  if (Object.keys(personUpdate).length > 0) {
    const { error } = await supabase.from('persons').update(personUpdate).eq('id', personId)
    if (error) return { success: false, error: error.message }
  }

  // Update membership
  const membershipUpdate: Record<string, unknown> = {}
  if (role_type_id !== undefined) membershipUpdate.role_type_id = role_type_id
  if (status_id !== undefined) membershipUpdate.status_id = status_id

  if (Object.keys(membershipUpdate).length > 0) {
    const { error } = await supabase
      .from('group_memberships')
      .update(membershipUpdate)
      .eq('person_id', personId)
      .eq('group_id', groupId)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath(`${parentSlug ? '/' + parentSlug : ''}/${orgSlug}/members/${personId}`)
  revalidatePath(`${parentSlug ? '/' + parentSlug : ''}/${orgSlug}/members`)
  revalidatePath(`${parentSlug ? '/' + parentSlug : ''}/${orgSlug}/dashboard`)

  return { success: true }
}

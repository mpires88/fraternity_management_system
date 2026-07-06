'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type CreateSubgroupInput = {
  groupId: string
  name: string
  subgroup_type: string
  membership_type?: string
  is_private?: boolean
  parentSlug: string | null
  orgSlug: string
}

export async function createSubgroup(input: CreateSubgroupInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const slug = input.name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  const { error } = await supabase.from('subgroups').insert({
    group_id: input.groupId,
    name: input.name,
    slug,
    subgroup_type: input.subgroup_type,
    membership_type: input.membership_type ?? 'appointed',
    is_private: input.is_private ?? false,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`${input.parentSlug ? '/' + input.parentSlug : ''}/${input.orgSlug}/subgroups`)
  return { success: true }
}

type AddMemberInput = {
  subgroupId: string
  personId: string
  role?: string
  parentSlug: string | null
  orgSlug: string
  subgroupSlug: string
}

export async function addSubgroupMember(input: AddMemberInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('subgroup_members').insert({
    subgroup_id: input.subgroupId,
    person_id: input.personId,
    role: input.role ?? 'member',
    join_type: 'appointed',
    appointed_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Already a member' }
    return { success: false, error: error.message }
  }

  revalidatePath(
    `${input.parentSlug ? '/' + input.parentSlug : ''}/${input.orgSlug}/subgroups/${input.subgroupSlug}`
  )
  return { success: true }
}

type RemoveMemberInput = {
  membershipId: string
  parentSlug: string | null
  orgSlug: string
  subgroupSlug: string
}

export async function removeSubgroupMember(input: RemoveMemberInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('subgroup_members')
    .update({ left_at: new Date().toISOString().split('T')[0] })
    .eq('id', input.membershipId)

  if (error) return { success: false, error: error.message }

  revalidatePath(
    `${input.parentSlug ? '/' + input.parentSlug : ''}/${input.orgSlug}/subgroups/${input.subgroupSlug}`
  )
  return { success: true }
}

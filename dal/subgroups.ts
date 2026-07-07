import type { DbClient } from '@/dal/types'
import { UserFacingError } from '@/lib/errors'

export type SubgroupListItem = {
  id: string
  name: string
  slug: string
  subgroup_type: string | null
  membership_type: string | null
  is_private: boolean
  is_locked: boolean
  member_count: number
  head: { full_name: string; person_id: string } | null
}

export type SubgroupDetail = SubgroupListItem & {
  can_rename: boolean
  head_position_id: string | null
  head_position_title: string | null
  members: {
    id: string
    person_id: string
    full_name: string
    nickname: string | null
    profile_photo: string | null
    role: string
    join_type: string | null
    joined_at: string | null
  }[]
}

/**
 * All subgroups for an org with member counts and head info.
 */
export async function getSubgroupsByOrg(
  supabase: DbClient,
  groupId: string
): Promise<SubgroupListItem[]> {
  const { data: subgroups } = await supabase
    .from('subgroups')
    .select(
      'id, name, slug, subgroup_type, membership_type, is_private, is_locked, head_position_id'
    )
    .eq('group_id', groupId)
    .order('subgroup_type')
    .order('name')

  if (!subgroups) return []

  // Get member counts
  const { data: memberRows } = await supabase
    .from('subgroup_members')
    .select('subgroup_id')
    .in(
      'subgroup_id',
      subgroups.map((s) => s.id)
    )
    .is('left_at', null)

  const counts: Record<string, number> = {}
  for (const row of memberRows ?? []) {
    counts[row.subgroup_id] = (counts[row.subgroup_id] ?? 0) + 1
  }

  // Get heads (members with role='head')
  const { data: heads } = await supabase
    .from('subgroup_members')
    .select('subgroup_id, person_id, persons!subgroup_members_person_id_fkey(full_name)')
    .in(
      'subgroup_id',
      subgroups.map((s) => s.id)
    )
    .eq('role', 'head')
    .is('left_at', null)

  const headMap: Record<string, { full_name: string; person_id: string }> = {}
  for (const h of heads ?? []) {
    const person = h.persons as { full_name: string }
    headMap[h.subgroup_id] = { full_name: person.full_name, person_id: h.person_id }
  }

  return subgroups.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    subgroup_type: s.subgroup_type,
    membership_type: s.membership_type,
    is_private: s.is_private ?? false,
    is_locked: s.is_locked ?? false,
    member_count: counts[s.id] ?? 0,
    head: headMap[s.id] ?? null,
  }))
}

/**
 * Single subgroup with full member list.
 */
export async function getSubgroupBySlug(
  supabase: DbClient,
  groupId: string,
  slug: string
): Promise<SubgroupDetail | null> {
  const { data: subgroup } = await supabase
    .from('subgroups')
    .select('*, positions(title)')
    .eq('group_id', groupId)
    .eq('slug', slug)
    .single()

  if (!subgroup) return null

  // Get members
  const { data: memberRows } = await supabase
    .from('subgroup_members')
    .select(
      'id, person_id, role, join_type, joined_at, persons!subgroup_members_person_id_fkey(full_name, nickname, profile_photo)'
    )
    .eq('subgroup_id', subgroup.id)
    .is('left_at', null)
    .order('role', { ascending: true })

  const members = (memberRows ?? []).map((m) => {
    const person = m.persons as {
      full_name: string
      nickname: string | null
      profile_photo: string | null
    }
    return {
      id: m.id,
      person_id: m.person_id,
      full_name: person.full_name,
      nickname: person.nickname,
      profile_photo: person.profile_photo,
      role: m.role ?? 'member',
      join_type: m.join_type,
      joined_at: m.joined_at,
    }
  })

  // Get head from members
  const headMember = members.find((m) => m.role === 'head')
  const headPositionTitle = (subgroup.positions as { title: string } | null)?.title ?? null

  // Count (active only)
  const memberCount = members.length

  return {
    id: subgroup.id,
    name: subgroup.name,
    slug: subgroup.slug,
    subgroup_type: subgroup.subgroup_type,
    membership_type: subgroup.membership_type,
    is_private: subgroup.is_private ?? false,
    is_locked: subgroup.is_locked ?? false,
    can_rename: subgroup.can_rename ?? true,
    head_position_id: subgroup.head_position_id,
    head_position_title: headPositionTitle,
    member_count: memberCount,
    head: headMember ? { full_name: headMember.full_name, person_id: headMember.person_id } : null,
    members,
  }
}

export async function createSubgroupDal(
  supabase: DbClient,
  groupId: string,
  input: { name: string; subgroup_type: string; membership_type?: string; is_private?: boolean }
): Promise<void> {
  const slug = input.name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  const { error } = await supabase.from('subgroups').insert({
    group_id: groupId,
    name: input.name,
    slug,
    subgroup_type: input.subgroup_type,
    membership_type: input.membership_type ?? 'appointed',
    is_private: input.is_private ?? false,
  })

  if (error) throw new UserFacingError(error.message)
}

export async function addSubgroupMemberDal(
  supabase: DbClient,
  appointedBy: string,
  input: { subgroupId: string; personId: string; role?: string }
): Promise<void> {
  const { error } = await supabase.from('subgroup_members').insert({
    subgroup_id: input.subgroupId,
    person_id: input.personId,
    role: input.role ?? 'member',
    join_type: 'appointed',
    appointed_by: appointedBy,
  })

  if (error) {
    if (error.code === '23505') throw new UserFacingError('Already a member')
    throw new UserFacingError(error.message)
  }
}

export async function removeSubgroupMemberDal(
  supabase: DbClient,
  membershipId: string
): Promise<void> {
  const { error } = await supabase
    .from('subgroup_members')
    .update({ left_at: new Date().toISOString().split('T')[0] })
    .eq('id', membershipId)

  if (error) throw new UserFacingError(error.message)
}

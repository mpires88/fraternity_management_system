import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DbClient } from '@/dal/types'
import { UserFacingError } from '@/lib/errors'
import type { OrgMembership, Person, RoleType, StatusDefinition } from '@/lib/types/db'
import type { InviteMemberInput, UpdateMemberInput } from '@/lib/validations/member'

export type InviteResult = { personId: string; claimToken: string }

export type MemberRow = OrgMembership & {
  person: Person
  role_type: RoleType
  status_definition: StatusDefinition
  /** @deprecated Use role_type */
  membership_type: RoleType
}

/**
 * Returns all members for an org, with person, role, and status data.
 * Excludes expelled members.
 */
export async function getMembersByOrg(supabase: DbClient, groupId: string): Promise<MemberRow[]> {
  const { data } = await supabase
    .from('group_memberships')
    .select('*, persons(*), role_types(*), status_definitions(*)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })

  if (!data) return []

  return data
    .filter((row) => {
      const sd = (row as { status_definitions: { slug: string } }).status_definitions
      return sd?.slug !== 'expelled'
    })
    .map((row) => {
      const r = row as unknown as OrgMembership & {
        persons: Person
        role_types: RoleType
        status_definitions: StatusDefinition
      }
      const {
        persons: person,
        role_types: role_type,
        status_definitions: status_definition,
        ...membership
      } = r
      return {
        ...membership,
        person,
        role_type,
        status_definition,
        membership_type: role_type, // backwards compat
      } as MemberRow
    })
}

/** person_ids of the group's current members (active membership, not expelled). */
export async function getActiveMemberPersonIdsDal(
  supabase: DbClient,
  groupId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('group_memberships')
    .select('person_id, status_definitions(slug)')
    .eq('group_id', groupId)
    .is('ended_at', null)

  return [
    ...new Set(
      (data ?? [])
        .filter((m) => (m.status_definitions as { slug: string } | null)?.slug !== 'expelled')
        .map((m) => m.person_id)
    ),
  ]
}

/** person_ids of the group's full-access (officer/admin) members. */
export async function getFullAccessPersonIdsDal(
  supabase: DbClient,
  groupId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('group_memberships')
    .select('person_id, role_types!inner(access_level)')
    .eq('group_id', groupId)
    .eq('role_types.access_level', 'full')
    .is('ended_at', null)
  return [...new Set((data ?? []).map((m) => m.person_id))]
}

export async function inviteMemberDal(
  supabase: DbClient,
  groupId: string,
  invitedBy: string,
  input: InviteMemberInput
): Promise<InviteResult> {
  const { school_email, full_name, role_type_id, invite_email } = input

  // Service-role client for person creation + claim tokens; create at most once
  let adminClient: SupabaseClient | null = null
  const getAdmin = () => {
    adminClient ??= createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    return adminClient
  }

  const { data: existingPerson } = await supabase
    .from('persons')
    .select('id, auth_user_id')
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
      throw new UserFacingError('This person is already a member of this group')
    }
  } else {
    const newId = crypto.randomUUID()
    const { error: personError } = await getAdmin()
      .from('persons')
      .insert({ id: newId, full_name, school_email })

    if (personError) {
      throw new UserFacingError(`Failed to create person: ${personError.message}`)
    }

    personId = newId
  }

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
    throw new UserFacingError(`Failed to create membership: ${membershipError.message}`)
  }

  // Create claim token (skip for already-claimed persons)
  const alreadyClaimed = existingPerson?.auth_user_id != null
  if (alreadyClaimed) {
    return { personId, claimToken: '' }
  }

  const { data: tokenRow, error: tokenError } = await getAdmin()
    .from('claim_tokens')
    .insert({
      person_id: personId,
      email: invite_email ?? school_email,
      group_id: groupId,
      created_by: invitedBy,
    })
    .select('token')
    .single()

  if (tokenError) {
    throw new UserFacingError(`Failed to create invite token: ${tokenError.message}`)
  }

  return { personId, claimToken: tokenRow.token }
}

export async function updateMemberDal(
  supabase: DbClient,
  groupId: string,
  input: UpdateMemberInput
): Promise<void> {
  const { personId, role_type_id, status_id, ...personFields } = input

  const personUpdate: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(personFields)) {
    if (v !== undefined) personUpdate[k] = v
  }

  if (Object.keys(personUpdate).length > 0) {
    const { error } = await supabase.from('persons').update(personUpdate).eq('id', personId)
    if (error) throw new UserFacingError(error.message)
  }

  const membershipUpdate: Record<string, unknown> = {}
  if (role_type_id !== undefined) membershipUpdate.role_type_id = role_type_id
  if (status_id !== undefined) membershipUpdate.status_id = status_id

  if (Object.keys(membershipUpdate).length > 0) {
    const { error } = await supabase
      .from('group_memberships')
      .update(membershipUpdate)
      .eq('person_id', personId)
      .eq('group_id', groupId)
    if (error) throw new UserFacingError(error.message)
  }
}

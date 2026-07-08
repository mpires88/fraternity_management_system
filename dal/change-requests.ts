import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { DbClient } from '@/dal/types'
import type { SubmitChangeRequestInput } from '@/lib/validations/change-request'

export type ChangeRequest = {
  id: string
  person_id: string
  group_id: string
  field_name: string
  current_value: string | null
  requested_value: string
  reason: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  person?: { full_name: string; profile_photo: string | null }
  reviewer?: { full_name: string } | null
}

export async function getMyChangeRequests(
  supabase: DbClient,
  personId: string
): Promise<ChangeRequest[]> {
  const { data } = await supabase
    .from('profile_change_requests')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data ?? []) as ChangeRequest[]
}

export async function getPendingChangeRequests(
  supabase: DbClient,
  groupId: string
): Promise<ChangeRequest[]> {
  const { data } = await supabase
    .from('profile_change_requests')
    .select('*, persons!profile_change_requests_person_id_fkey(full_name, profile_photo)')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (data ?? []).map((row) => {
    const { persons, ...rest } = row as Record<string, unknown>
    return {
      ...rest,
      person: persons as { full_name: string; profile_photo: string | null },
    } as ChangeRequest
  })
}

export async function createChangeRequest(
  supabase: DbClient,
  personId: string,
  input: SubmitChangeRequestInput
): Promise<void> {
  const { error } = await supabase.from('profile_change_requests').insert({
    person_id: personId,
    group_id: input.group_id,
    field_name: input.field_name,
    current_value: input.current_value,
    requested_value: input.requested_value,
    reason: input.reason ?? null,
  })
  if (error) throw new Error(error.message)
}

const PERSON_FIELDS = [
  'school_email',
  'expected_grad_year',
  'member_number',
  'initiation_date',
  'bid_date',
  'major',
]

export async function reviewChangeRequest(
  supabase: DbClient,
  requestId: string,
  decision: 'approved' | 'rejected',
  reviewerId: string
): Promise<void> {
  const { data: request, error: fetchError } = await supabase
    .from('profile_change_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !request) throw new Error('Request not found or already reviewed')

  const { error: updateError } = await supabase
    .from('profile_change_requests')
    .update({
      status: decision,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) throw new Error(updateError.message)

  if (decision === 'approved') {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (PERSON_FIELDS.includes(request.field_name)) {
      await admin
        .from('persons')
        .update({ [request.field_name]: request.requested_value })
        .eq('id', request.person_id)
    } else if (request.field_name === 'role_type_id' || request.field_name === 'status_id') {
      await admin
        .from('group_memberships')
        .update({ [request.field_name]: request.requested_value })
        .eq('person_id', request.person_id)
        .eq('group_id', request.group_id)
        .is('ended_at', null)
    }
  }
}

import type { DbClient } from '@/dal/types'
import type { Json } from '@/lib/supabase/types'

export type PollRow = {
  id: string
  title: string
  description: string | null
  lifecycle: string
  status: string
  opens_at: string | null
  closes_at: string | null
  voting_method: string
  method_settings: Record<string, unknown>
  vote_privacy: string
  quorum: number | null
  allow_proxies: boolean
  allow_abstain: boolean
  created_by: string
  created_at: string
}

export type PollOptionRow = {
  id: string
  label: string
  description: string | null
  sort_order: number
}

export type VoteRow = {
  id: string
  person_id: string
  cast_by_person_id: string | null
  vote_data: Record<string, unknown>
  created_at: string
}

export async function getPollsForGroup(
  supabase: DbClient,
  groupId: string,
  termId?: string
): Promise<PollRow[]> {
  let query = supabase
    .from('polls')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (termId) {
    query = query.eq('term_id', termId)
  }

  const { data } = await query
  return (data ?? []) as PollRow[]
}

export async function getPollById(supabase: DbClient, pollId: string): Promise<PollRow | null> {
  const { data } = await supabase.from('polls').select('*').eq('id', pollId).single()
  return (data as PollRow) ?? null
}

export async function getPollOptions(supabase: DbClient, pollId: string): Promise<PollOptionRow[]> {
  const { data } = await supabase
    .from('poll_options')
    .select('id, label, description, sort_order')
    .eq('poll_id', pollId)
    .order('sort_order')
  return (data ?? []) as PollOptionRow[]
}

export async function getVotesForPoll(supabase: DbClient, pollId: string): Promise<VoteRow[]> {
  const { data } = await supabase
    .from('votes')
    .select('id, person_id, cast_by_person_id, vote_data, created_at')
    .eq('poll_id', pollId)
  return (data ?? []) as VoteRow[]
}

export async function getParticipantCount(supabase: DbClient, pollId: string): Promise<number> {
  const { count } = await supabase
    .from('poll_participants')
    .select('id', { count: 'exact', head: true })
    .eq('poll_id', pollId)
  return count ?? 0
}

export async function hasVoted(
  supabase: DbClient,
  pollId: string,
  personId: string
): Promise<boolean> {
  const { count } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('poll_id', pollId)
    .eq('person_id', personId)
  return (count ?? 0) > 0
}

export type CreatePollInput = {
  title: string
  description?: string
  voting_method: string
  method_settings?: Record<string, unknown>
  vote_privacy?: string
  quorum?: number
  allow_proxies?: boolean
  allow_abstain?: boolean
  term_id?: string
  options: { label: string; description?: string }[]
}

export async function createPollDal(
  supabase: DbClient,
  groupId: string,
  createdBy: string,
  input: CreatePollInput
): Promise<string> {
  const { data: poll, error } = await supabase
    .from('polls')
    .insert({
      group_id: groupId,
      created_by: createdBy,
      title: input.title,
      description: input.description,
      voting_method: input.voting_method,
      method_settings: (input.method_settings ?? {}) as Json,
      vote_privacy: input.vote_privacy ?? 'public',
      quorum: input.quorum,
      allow_proxies: input.allow_proxies ?? false,
      allow_abstain: input.allow_abstain ?? true,
      term_id: input.term_id,
    })
    .select('id')
    .single()

  if (error || !poll) throw error

  const options = input.options.map((o, i) => ({
    poll_id: poll.id,
    label: o.label,
    description: o.description,
    sort_order: i,
  }))

  await supabase.from('poll_options').insert(options)

  return poll.id
}

export async function publishPollDal(supabase: DbClient, pollId: string) {
  await supabase
    .from('polls')
    .update({ lifecycle: 'published', updated_at: new Date().toISOString() })
    .eq('id', pollId)
}

export async function closePollDal(supabase: DbClient, pollId: string) {
  await supabase
    .from('polls')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', pollId)
}

export async function archivePollDal(supabase: DbClient, pollId: string) {
  await supabase
    .from('polls')
    .update({ lifecycle: 'archived', updated_at: new Date().toISOString() })
    .eq('id', pollId)
}

export async function getParticipantPersonIdsDal(
  supabase: DbClient,
  pollId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('poll_participants')
    .select('person_id')
    .eq('poll_id', pollId)
  return [...new Set((data ?? []).map((p) => p.person_id).filter(Boolean))] as string[]
}

export async function addParticipantsDal(supabase: DbClient, pollId: string, personIds: string[]) {
  const rows = personIds.map((pid) => ({ poll_id: pollId, person_id: pid }))
  await supabase.from('poll_participants').upsert(rows, { onConflict: 'poll_id,person_id' })
}

export async function castVoteDal(
  supabase: DbClient,
  pollId: string,
  personId: string,
  voteData: Record<string, unknown>,
  castByPersonId?: string
) {
  await supabase.from('votes').insert({
    poll_id: pollId,
    person_id: personId,
    cast_by_person_id: castByPersonId ?? null,
    vote_data: voteData as Json,
  })
}

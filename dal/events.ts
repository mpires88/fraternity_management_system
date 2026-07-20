import type { DbClient, MutationResult } from '@/dal/types'

export type EventRow = {
  id: string
  group_id: string
  term_id: string | null
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  kind: string
  category_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export async function getEventsForGroupDal(
  supabase: DbClient,
  groupId: string,
  kind?: string,
  termId?: string
): Promise<EventRow[]> {
  let query = supabase
    .from('events')
    .select('*')
    .eq('group_id', groupId)
    .order('starts_at', { ascending: false })

  if (kind) query = query.eq('kind', kind)
  if (termId) query = query.eq('term_id', termId)

  const { data } = await query
  return (data ?? []) as EventRow[]
}

export async function getEventByIdDal(
  supabase: DbClient,
  eventId: string
): Promise<EventRow | null> {
  const { data } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
  return data as EventRow | null
}

export async function createEventDal(
  supabase: DbClient,
  groupId: string,
  createdBy: string,
  input: {
    title: string
    description?: string | null
    starts_at: string
    ends_at?: string | null
    location?: string | null
    kind: string
    term_id?: string | null
    category_id?: string | null
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      group_id: groupId,
      created_by: createdBy,
      title: input.title,
      description: input.description ?? null,
      starts_at: input.starts_at,
      ends_at: input.ends_at ?? null,
      location: input.location ?? null,
      kind: input.kind,
      term_id: input.term_id ?? null,
      category_id: input.category_id ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create event: ${error.message}`)
  return data.id
}

export async function updateEventDal(
  supabase: DbClient,
  eventId: string,
  updates: {
    title?: string
    description?: string | null
    starts_at?: string
    ends_at?: string | null
    location?: string | null
    category_id?: string | null
  }
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', eventId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteEventDal(
  supabase: DbClient,
  eventId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

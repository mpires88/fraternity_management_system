import type { DbClient } from '@/dal/types'
import type { Term } from '@/lib/types/db'

/**
 * Returns the current active term for an org, or null if none.
 */
export async function getCurrentTerm(supabase: DbClient, groupId: string): Promise<Term | null> {
  const { data } = await supabase
    .from('terms')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .limit(1)
    .single()

  return (data as Term) ?? null
}

/**
 * Returns all terms for an org, ordered by year desc then ordinal.
 */
export async function getTermsByOrg(supabase: DbClient, groupId: string): Promise<Term[]> {
  const { data } = await supabase
    .from('terms')
    .select('*')
    .eq('group_id', groupId)
    .order('year', { ascending: false })
    .order('starts_on', { ascending: false })

  return (data as Term[]) ?? []
}

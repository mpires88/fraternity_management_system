import type { DbClient } from '@/dal/types'

export type DashboardData = {
  memberCounts: { active: number; candidate: number; away: number; alumni: number; total: number }
  currentTerm: { id: string; name: string; starts_on: string; ends_on: string } | null
  currentOfficers: {
    person_name: string
    person_id: string
    position_title: string
    position_type: string | null
  }[]
}

export async function getDashboardData(
  supabase: DbClient,
  groupId: string
): Promise<DashboardData> {
  // Member counts by status + current term (independent lookups)
  const [membershipsRes, currentTermRes] = await Promise.all([
    supabase
      .from('group_memberships')
      .select('status_id, status_definitions(slug)')
      .eq('group_id', groupId),
    supabase
      .from('terms')
      .select('id, name, starts_on, ends_on')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
  ])
  const memberships = membershipsRes.data
  const currentTerm = currentTermRes.data

  const counts = { active: 0, candidate: 0, away: 0, alumni: 0, total: 0 }
  for (const m of memberships ?? []) {
    const slug = (m.status_definitions as { slug: string })?.slug
    if (slug === 'expelled') continue
    counts.total++
    if (slug === 'candidate') counts.candidate++
    else if (slug === 'alumni_brother') counts.alumni++
    else if (slug === 'away') counts.away++
    else if (slug === 'active') counts.active++
  }

  // Find the latest term that has position assignments
  // (the "current" term from seed may not have assignments — the CSV data does)
  let officerTermId: string | null = null

  if (currentTerm) {
    // Check if current term has assignments
    const { count } = await supabase
      .from('position_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('term_id', currentTerm.id)

    if (count && count > 0) {
      officerTermId = currentTerm.id
    }
  }

  // Fallback: find the most recent term that has assignments
  if (!officerTermId) {
    const { data: latestAssignment } = await supabase
      .from('position_assignments')
      .select('term_id, terms(starts_on)')
      .eq('group_id', groupId)
      .order('terms(starts_on)', { ascending: false })
      .limit(1)
      .single()

    officerTermId = latestAssignment?.term_id ?? null
  }

  // Load officers for that term
  let currentOfficers: DashboardData['currentOfficers'] = []

  if (officerTermId) {
    const { data: officerRows } = await supabase
      .from('position_assignments')
      .select(
        'person_id, persons!position_assignments_person_id_fkey(full_name), positions(title, type, display_order)'
      )
      .eq('group_id', groupId)
      .eq('term_id', officerTermId)

    // Sort in JS since foreign-table ordering may not work
    const sorted = (officerRows ?? []).sort((a, b) => {
      const aOrder = (a.positions as { display_order: number | null })?.display_order ?? 99
      const bOrder = (b.positions as { display_order: number | null })?.display_order ?? 99
      return aOrder - bOrder
    })

    currentOfficers = sorted.map((o: Record<string, unknown>) => {
      const person = o.persons as { full_name: string }
      const pos = o.positions as { title: string; type: string | null }
      return {
        person_name: person.full_name,
        person_id: o.person_id as string,
        position_title: pos.title,
        position_type: pos.type,
      }
    })
  }

  return { memberCounts: counts, currentTerm, currentOfficers }
}

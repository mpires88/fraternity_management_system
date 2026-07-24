import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DbClient, MutationResult } from '@/dal/types'
import { UserFacingError } from '@/lib/errors'

// ── Prospect types ──────────────────────────────────────────────────────────

export type ProspectRow = {
  id: string
  group_id: string
  term_id: string
  full_name: string
  email: string | null
  phone: string | null
  school_year: string | null
  status: string
  is_legacy: boolean
  poll_id: string | null
  photo_path: string | null
  converted_person_id: string | null
  added_by: string
  created_at: string
  updated_at: string
}

export type ProspectWithCounts = ProspectRow & {
  attendance_count: number
  feedback_count: number
}

export type ProspectDetail = ProspectRow & {
  added_by_name: string
  attendance: Array<{
    id: string
    event_id: string
    event_title: string
    checked_in_by_name: string
    created_at: string
  }>
  feedback: Array<{
    id: string
    author_person_id: string
    author_name: string
    body: string
    rating: number | null
    created_at: string
  }>
}

// ── Prospect queries ────────────────────────────────────────────────────────

export async function getProspectsForTermDal(
  supabase: DbClient,
  groupId: string,
  termId: string
): Promise<ProspectWithCounts[]> {
  // Aggregate counts — the DB returns two integers per prospect instead of
  // shipping every attendance/feedback child row over the wire
  const { data } = await supabase
    .from('prospects')
    .select('*, event_prospect_attendance(count), prospect_feedback(count)')
    .eq('group_id', groupId)
    .eq('term_id', termId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    ...(row as unknown as ProspectRow),
    attendance_count:
      (row.event_prospect_attendance as unknown as { count: number }[])?.[0]?.count ?? 0,
    feedback_count: (row.prospect_feedback as unknown as { count: number }[])?.[0]?.count ?? 0,
  }))
}

export type ProspectCore = Pick<
  ProspectRow,
  'id' | 'full_name' | 'is_legacy' | 'poll_id' | 'status' | 'email'
>

/** Lightweight prospect fetch for vote/conversion paths — no joined graph. */
export async function getProspectCoresDal(
  supabase: DbClient,
  prospectIds: string[]
): Promise<ProspectCore[]> {
  if (prospectIds.length === 0) return []
  const { data } = await supabase
    .from('prospects')
    .select('id, full_name, is_legacy, poll_id, status, email')
    .in('id', prospectIds)
  return (data ?? []) as ProspectCore[]
}

/**
 * The prospect whose bid vote is this poll, if any. Returns null for polls that
 * aren't bid votes (e.g. a budget ratification) — lets the generic poll-close
 * path decide whether a prospect status flip applies.
 */
export async function getProspectByPollIdDal(
  supabase: DbClient,
  pollId: string
): Promise<ProspectCore | null> {
  const { data } = await supabase
    .from('prospects')
    .select('id, full_name, is_legacy, poll_id, status, email')
    .eq('poll_id', pollId)
    .maybeSingle()
  return (data as ProspectCore) ?? null
}

/** The group's active term, if any. */
export async function getActiveTermDal(
  supabase: DbClient,
  groupId: string
): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from('terms')
    .select('id, name')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return data
}

export type ConversionLookups = {
  roleTypes: { id: string; name: string }[]
  candidateSubgroups: { id: string; name: string }[]
  statuses: { id: string; name: string; slug: string }[]
}

/** Role/status/candidate-class options for the convert-to-member dialog. */
export async function getConversionLookupsDal(
  supabase: DbClient,
  groupId: string
): Promise<ConversionLookups> {
  const [roleTypesRes, subgroupsRes, statusesRes] = await Promise.all([
    supabase.from('role_types').select('id, name').eq('group_id', groupId).order('display_order'),
    supabase
      .from('subgroups')
      .select('id, name')
      .eq('group_id', groupId)
      .eq('subgroup_type', 'new_member_class')
      .order('name'),
    supabase
      .from('status_definitions')
      .select('id, name, slug')
      .or(`group_id.eq.${groupId},group_id.is.null`)
      .order('display_order'),
  ])

  return {
    roleTypes: (roleTypesRes.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    candidateSubgroups: (subgroupsRes.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    statuses: (statusesRes.data ?? []).map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
  }
}

export async function getProspectDetailDal(
  supabase: DbClient,
  prospectId: string
): Promise<ProspectDetail | null> {
  const { data } = await supabase
    .from('prospects')
    .select(
      `*,
       added_by_person:persons!prospects_added_by_fkey(full_name),
       event_prospect_attendance(
         id, event_id, created_at,
         events(title),
         checked_in_person:persons!event_prospect_attendance_checked_in_by_fkey(full_name)
       ),
       prospect_feedback(
         id, author_person_id, body, rating, created_at,
         author:persons!prospect_feedback_author_person_id_fkey(full_name)
       )`
    )
    .eq('id', prospectId)
    .maybeSingle()

  if (!data) return null

  const row = data as Record<string, unknown>
  const base = data as unknown as ProspectRow
  const addedByPerson = row.added_by_person as { full_name: string } | null

  const rawAttendance = (row.event_prospect_attendance ?? []) as Array<{
    id: string
    event_id: string
    created_at: string
    events: { title: string } | null
    checked_in_person: { full_name: string } | null
  }>

  const rawFeedback = (row.prospect_feedback ?? []) as Array<{
    id: string
    author_person_id: string
    body: string
    rating: number | null
    created_at: string
    author: { full_name: string } | null
  }>

  return {
    ...base,
    added_by_name: addedByPerson?.full_name ?? 'Unknown',
    attendance: rawAttendance.map((a) => ({
      id: a.id,
      event_id: a.event_id,
      event_title: a.events?.title ?? 'Unknown',
      checked_in_by_name: a.checked_in_person?.full_name ?? 'Unknown',
      created_at: a.created_at,
    })),
    feedback: rawFeedback.map((f) => ({
      id: f.id,
      author_person_id: f.author_person_id,
      author_name: f.author?.full_name ?? 'Unknown',
      body: f.body,
      rating: f.rating,
      created_at: f.created_at,
    })),
  }
}

// ── Prospect mutations ──────────────────────────────────────────────────────

export async function createProspectDal(
  supabase: DbClient,
  groupId: string,
  addedBy: string,
  input: {
    full_name: string
    email?: string | null
    phone?: string | null
    school_year?: string | null
    is_legacy?: boolean
    term_id: string
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('prospects')
    .insert({
      group_id: groupId,
      added_by: addedBy,
      full_name: input.full_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      school_year: input.school_year ?? null,
      is_legacy: input.is_legacy ?? false,
      term_id: input.term_id,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create prospect: ${error.message}`)
  return data.id
}

export async function updateProspectDal(
  supabase: DbClient,
  prospectId: string,
  updates: {
    full_name?: string
    email?: string | null
    phone?: string | null
    school_year?: string | null
    is_legacy?: boolean
  }
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('prospects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', prospectId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function setProspectStatusDal(
  supabase: DbClient,
  prospectId: string,
  status: string
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('prospects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', prospectId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteProspectDal(
  supabase: DbClient,
  prospectId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase.from('prospects').delete().eq('id', prospectId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function linkPollToProspectDal(
  supabase: DbClient,
  prospectId: string,
  pollId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('prospects')
    .update({ poll_id: pollId, updated_at: new Date().toISOString() })
    .eq('id', prospectId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Group calendar settings ─────────────────────────────────────────────────

export type RecruitmentCalendarHours = { start_hour: number; end_hour: number }

export const DEFAULT_RECRUITMENT_CALENDAR_HOURS: RecruitmentCalendarHours = {
  start_hour: 8,
  end_hour: 24,
}

/** Read the group's calendar window from groups.settings, falling back to 8am–12am. */
export function readRecruitmentCalendarHours(
  settings: Record<string, unknown> | null | undefined
): RecruitmentCalendarHours {
  const cal = (settings ?? {})?.recruitment_calendar as
    | Partial<RecruitmentCalendarHours>
    | undefined
  const start = typeof cal?.start_hour === 'number' ? cal.start_hour : null
  const end = typeof cal?.end_hour === 'number' ? cal.end_hour : null
  if (start === null || end === null || end <= start) return DEFAULT_RECRUITMENT_CALENDAR_HOURS
  return { start_hour: start, end_hour: end }
}

/**
 * Persist the calendar window into groups.settings (merging, not replacing).
 * Gated by RLS to organization admins — the groups_update policy is the boundary.
 */
export async function updateRecruitmentCalendarHoursDal(
  supabase: DbClient,
  groupId: string,
  startHour: number,
  endHour: number
): Promise<MutationResult<void>> {
  const { data, error: readError } = await supabase
    .from('groups')
    .select('settings')
    .eq('id', groupId)
    .single()
  if (readError) return { success: false, error: readError.message }

  const settings = (data?.settings ?? {}) as Record<string, unknown>
  const next = { ...settings, recruitment_calendar: { start_hour: startHour, end_hour: endHour } }
  const { error } = await supabase.from('groups').update({ settings: next }).eq('id', groupId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Attendance ──────────────────────────────────────────────────────────────

export async function checkInProspectDal(
  supabase: DbClient,
  eventId: string,
  prospectId: string,
  checkedInBy: string
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('event_prospect_attendance')
    .insert({ event_id: eventId, prospect_id: prospectId, checked_in_by: checkedInBy })
  if (error) {
    if (error.code === '23505') return { success: true }
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function removeCheckInDal(
  supabase: DbClient,
  eventId: string,
  prospectId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('event_prospect_attendance')
    .delete()
    .eq('event_id', eventId)
    .eq('prospect_id', prospectId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Feedback ────────────────────────────────────────────────────────────────

export async function addFeedbackDal(
  supabase: DbClient,
  input: {
    prospect_id: string
    author_person_id: string
    body: string
    rating?: number | null
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('prospect_feedback')
    .insert({
      prospect_id: input.prospect_id,
      author_person_id: input.author_person_id,
      body: input.body,
      rating: input.rating ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to add feedback: ${error.message}`)
  return data.id
}

export async function deleteFeedbackDal(
  supabase: DbClient,
  feedbackId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase.from('prospect_feedback').delete().eq('id', feedbackId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function purgeProspectFeedbackDal(
  supabase: DbClient,
  prospectId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase.from('prospect_feedback').delete().eq('prospect_id', prospectId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function purgeTermRecruitmentFeedbackDal(
  supabase: DbClient,
  groupId: string,
  termId: string
): Promise<MutationResult<void>> {
  const { data: prospects } = await supabase
    .from('prospects')
    .select('id')
    .eq('group_id', groupId)
    .eq('term_id', termId)

  if (!prospects || prospects.length === 0) return { success: true }

  const ids = prospects.map((p) => p.id)
  const { error } = await supabase.from('prospect_feedback').delete().in('prospect_id', ids)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Bid vote threshold resolution ───────────────────────────────────────────

export async function getBidVoteThresholdDal(
  supabase: DbClient,
  groupId: string,
  isLegacy: boolean
): Promise<number> {
  // One round trip for both the group's own settings and the national ones.
  // Deliberate fallback chain: legacy override → national threshold → 2/3.
  const { data: group } = await supabase
    .from('groups')
    .select('settings, organizations(parent_organizations(settings))')
    .eq('id', groupId)
    .single()

  if (isLegacy) {
    const settings = (group?.settings ?? {}) as Record<string, unknown>
    if (typeof settings.legacy_bid_vote_threshold === 'number') {
      return settings.legacy_bid_vote_threshold
    }
  }

  const org = group?.organizations as unknown as {
    parent_organizations: { settings: Record<string, unknown> } | null
  } | null
  const natSettings = org?.parent_organizations?.settings ?? {}
  if (typeof natSettings.bid_vote_threshold === 'number') {
    return natSettings.bid_vote_threshold
  }

  return 2 / 3
}

// ── Attendance list for an event ────────────────────────────────────────────

export async function getEventAttendanceDal(
  supabase: DbClient,
  eventId: string
): Promise<
  Array<{
    prospect_id: string
    prospect_name: string
    checked_in_by_name: string
    created_at: string
  }>
> {
  const { data } = await supabase
    .from('event_prospect_attendance')
    .select(
      'prospect_id, created_at, prospects(full_name), persons!event_prospect_attendance_checked_in_by_fkey(full_name)'
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((row) => ({
    prospect_id: row.prospect_id,
    prospect_name:
      (row.prospects as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
    checked_in_by_name:
      (row.persons as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
    created_at: row.created_at,
  }))
}

// ── Prospect conversion (bid acceptance → roster) ──────────────────────────

export type ConvertResult = {
  personId: string
  claimToken: string | null
}

export async function convertProspectDal(
  supabase: DbClient,
  groupId: string,
  convertedBy: string,
  input: {
    prospect_id: string
    role_type_id: string
    status_id: string
    subgroup_id?: string | null
  }
): Promise<ConvertResult> {
  const [prospect] = await getProspectCoresDal(supabase, [input.prospect_id])
  if (!prospect) throw new UserFacingError('Prospect not found')
  if (prospect.status !== 'offered') {
    throw new UserFacingError('Only prospects with status "offered" can be converted')
  }

  let adminClient: SupabaseClient | null = null
  const getAdmin = () => {
    adminClient ??= createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    return adminClient
  }

  // Ordering matters: everything that can fail runs BEFORE the two
  // irreversible steps (status flip, feedback purge), so a failure never
  // strands a half-converted prospect with its feedback already destroyed.

  // 1. Find or create person. Lookup via the admin client — the RLS-scoped
  // client can't see persons outside the actor's groups, which would mint a
  // duplicate identity for an existing cross-group person. Match either
  // email column: prospects are often entered under a personal address.
  let personId: string
  let alreadyClaimed = false

  if (prospect.email) {
    const { data: bySchool } = await getAdmin()
      .from('persons')
      .select('id, auth_user_id')
      .eq('school_email', prospect.email)
      .limit(1)
      .maybeSingle()
    const existing =
      bySchool ??
      (
        await getAdmin()
          .from('persons')
          .select('id, auth_user_id')
          .eq('personal_email', prospect.email)
          .limit(1)
          .maybeSingle()
      ).data

    if (existing) {
      personId = existing.id
      alreadyClaimed = existing.auth_user_id != null
    } else {
      personId = crypto.randomUUID()
      const { error } = await getAdmin()
        .from('persons')
        .insert({ id: personId, full_name: prospect.full_name, school_email: prospect.email })
      if (error) throw new UserFacingError(`Failed to create person: ${error.message}`)
    }
  } else {
    personId = crypto.randomUUID()
    const { error } = await getAdmin()
      .from('persons')
      .insert({
        id: personId,
        full_name: prospect.full_name,
        school_email: `placeholder-${personId.slice(0, 8)}@pending.local`,
      })
    if (error) throw new UserFacingError(`Failed to create person: ${error.message}`)
  }

  // 2. Guard against an existing active membership (matches inviteMemberDal),
  // then create the membership
  const { data: existingMembership } = await supabase
    .from('group_memberships')
    .select('id')
    .eq('person_id', personId)
    .eq('group_id', groupId)
    .is('ended_at', null)
    .limit(1)
    .maybeSingle()
  if (existingMembership) {
    throw new UserFacingError('This person is already a member of this group')
  }

  const { error: membershipError } = await supabase.from('group_memberships').insert({
    person_id: personId,
    group_id: groupId,
    role_type_id: input.role_type_id,
    status_id: input.status_id,
    joined_at: new Date().toISOString().split('T')[0],
  })
  if (membershipError) {
    throw new UserFacingError(`Failed to create membership: ${membershipError.message}`)
  }

  // 3. Add to candidate-class subgroup if specified
  if (input.subgroup_id) {
    const { error: subgroupError } = await supabase.from('subgroup_members').insert({
      subgroup_id: input.subgroup_id,
      person_id: personId,
      role: 'member',
      join_type: 'appointed',
      appointed_by: convertedBy,
    })
    if (subgroupError) {
      throw new UserFacingError(
        `Member created, but adding them to the candidate class failed: ${subgroupError.message}`
      )
    }
  }

  // 4. Issue claim token (skip if this person already has a login)
  let claimToken: string | null = null
  if (!alreadyClaimed && prospect.email) {
    const { data: tokenRow, error: tokenError } = await getAdmin()
      .from('claim_tokens')
      .insert({
        person_id: personId,
        email: prospect.email,
        group_id: groupId,
        created_by: convertedBy,
      })
      .select('token')
      .single()
    if (tokenError) {
      throw new UserFacingError(`Failed to create invite token: ${tokenError.message}`)
    }
    claimToken = tokenRow.token
  }

  // 5. Flip the prospect to accepted — checked, or the "offered" idempotency
  // guard above could never engage and a retry would double-convert
  const { error: statusError } = await supabase
    .from('prospects')
    .update({
      status: 'accepted',
      converted_person_id: personId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.prospect_id)
  if (statusError) {
    throw new UserFacingError(`Failed to update prospect status: ${statusError.message}`)
  }

  // 6. Purge feedback LAST — the one irreversible step
  const purge = await purgeProspectFeedbackDal(supabase, input.prospect_id)
  if (!purge.success) {
    throw new UserFacingError(`Converted, but feedback purge failed: ${purge.error}`)
  }

  return { personId, claimToken }
}

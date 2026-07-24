'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Actor } from '@/actions/utils/action-helpers'
import {
  createOrgAuthenticatedAction,
  createOrgQueryAction,
  createValidatedOrgAction,
  UserFacingError,
} from '@/actions/utils/action-helpers'
import type { EventRow } from '@/dal/events'
import { createEventDal, deleteEventDal, getEventsForGroupDal, updateEventDal } from '@/dal/events'
import { getActiveMemberPersonIdsDal } from '@/dal/members'
import { addParticipantsDal, createPollDal, publishPollDal } from '@/dal/polls'
import type {
  ConvertResult,
  ProspectCore,
  ProspectDetail,
  ProspectWithCounts,
} from '@/dal/recruitment'
import {
  addFeedbackDal,
  checkInProspectDal,
  convertProspectDal,
  createProspectDal,
  deleteFeedbackDal,
  deleteProspectDal,
  getBidVoteThresholdDal,
  getEventAttendanceDal,
  getProspectCoresDal,
  getProspectDetailDal,
  getProspectsForTermDal,
  linkPollToProspectDal,
  purgeProspectFeedbackDal,
  purgeTermRecruitmentFeedbackDal,
  removeCheckInDal,
  setProspectStatusDal,
  updateProspectDal,
  updateRecruitmentCalendarHoursDal,
} from '@/dal/recruitment'
import type { DbClient } from '@/dal/types'
import type { Database } from '@/lib/supabase/types'
import {
  addFeedbackSchema,
  convertProspectSchema,
  createProspectSchema,
  createRecruitmentEventSchema,
  recruitmentCalendarHoursSchema,
  setProspectStatusSchema,
  updateEventSchema,
  updateProspectSchema,
} from '@/lib/validations/recruitment'

/**
 * Actions that write through the service-role client (conversion) or drive
 * privileged flows must verify the recruitment gate themselves — RLS cannot
 * protect service-role writes.
 */
async function assertRecruitmentManager(supabase: DbClient, groupId: string): Promise<void> {
  const { data } = await supabase.rpc('get_my_module_admin_group_ids', { p_module: 'rush' })
  if (!((data as string[] | null) ?? []).includes(groupId)) {
    throw new UserFacingError('Only recruitment managers can do this')
  }
}

/**
 * Service-role client for bid-vote poll creation. The polls / poll_options /
 * poll_participants insert policies all require full group admin, but a bid
 * vote is run by a recruitment manager who may not be a full admin — so the
 * ballot is created through the service role AFTER assertRecruitmentManager
 * has verified the rush gate (exactly the convertProspect pattern). RLS cannot
 * protect a service-role write; the app-level gate is the boundary.
 */
function serviceRoleClient(): DbClient {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Prospect queries ────────────────────────────────────────────────────────

export const getProspects = createOrgQueryAction<{ termId: string }, ProspectWithCounts[]>(
  async (supabase, _actor, groupId, input) => {
    return getProspectsForTermDal(supabase, groupId, input.termId)
  }
)

export const getProspectDetail = createOrgQueryAction<{ prospectId: string }, ProspectDetail>(
  async (supabase, _actor, _groupId, input) => {
    const detail = await getProspectDetailDal(supabase, input.prospectId)
    if (!detail) throw new Error('Prospect not found')
    return detail
  }
)

// ── Prospect mutations ──────────────────────────────────────────────────────

export const createProspect = createValidatedOrgAction(
  createProspectSchema,
  async (supabase, actor, groupId, input) => {
    return createProspectDal(supabase, groupId, actor.personId, input)
  }
)

export const updateProspect = createValidatedOrgAction(
  updateProspectSchema,
  async (supabase, _actor, _groupId, input) => {
    const { id, ...updates } = input
    const result = await updateProspectDal(supabase, id, updates)
    if (!result.success) throw new Error(result.error)
  },
  { revalidatePaths: ['/recruitment'] }
)

export const setProspectStatus = createValidatedOrgAction(
  setProspectStatusSchema,
  async (supabase, _actor, _groupId, input) => {
    const result = await setProspectStatusDal(supabase, input.id, input.status)
    if (!result.success) throw new Error(result.error)
  },
  { revalidatePaths: ['/recruitment'] }
)

export const deleteProspect = createOrgAuthenticatedAction<{ prospectId: string }, void>(
  async (supabase, _actor, _groupId, input) => {
    const result = await deleteProspectDal(supabase, input.prospectId)
    if (!result.success) throw new Error(result.error)
  },
  { revalidatePaths: ['/recruitment'] }
)

export const linkPollToProspect = createOrgAuthenticatedAction<
  { prospectId: string; pollId: string },
  void
>(async (supabase, _actor, _groupId, input) => {
  const result = await linkPollToProspectDal(supabase, input.prospectId, input.pollId)
  if (!result.success) throw new Error(result.error)
})

// ── Event queries ───────────────────────────────────────────────────────────

export const getRecruitmentEvents = createOrgQueryAction<{ termId?: string }, EventRow[]>(
  async (supabase, _actor, groupId, input) => {
    return getEventsForGroupDal(supabase, groupId, 'recruitment', input.termId)
  }
)

export const getEventAttendance = createOrgQueryAction<
  { eventId: string },
  Awaited<ReturnType<typeof getEventAttendanceDal>>
>(async (supabase, _actor, _groupId, input) => {
  return getEventAttendanceDal(supabase, input.eventId)
})

// ── Group calendar settings ─────────────────────────────────────────────────

/**
 * Set the recruitment calendar's visible hour window for the group. Writing to
 * groups.settings is RLS-gated to organization admins — a non-admin call fails
 * at the database, which the core engine surfaces as an error.
 */
export const updateRecruitmentCalendarHours = createValidatedOrgAction(
  recruitmentCalendarHoursSchema,
  async (supabase, _actor, groupId, input) => {
    const result = await updateRecruitmentCalendarHoursDal(
      supabase,
      groupId,
      input.start_hour,
      input.end_hour
    )
    if (!result.success) throw new Error(result.error)
  },
  { revalidatePaths: ['/recruitment'] }
)

// ── Event mutations ─────────────────────────────────────────────────────────

export const createRecruitmentEvent = createValidatedOrgAction(
  createRecruitmentEventSchema,
  async (supabase, actor, groupId, input) => {
    return createEventDal(supabase, groupId, actor.personId, {
      ...input,
      kind: 'recruitment',
    })
  },
  { revalidatePaths: ['/recruitment'] }
)

export const updateRecruitmentEvent = createValidatedOrgAction(
  updateEventSchema,
  async (supabase, _actor, _groupId, input) => {
    const { id, ...updates } = input
    const result = await updateEventDal(supabase, id, updates)
    if (!result.success) throw new Error(result.error)
  },
  { revalidatePaths: ['/recruitment'] }
)

export const deleteRecruitmentEvent = createOrgAuthenticatedAction<{ eventId: string }, void>(
  async (supabase, _actor, _groupId, input) => {
    const result = await deleteEventDal(supabase, input.eventId)
    if (!result.success) throw new Error(result.error)
  },
  { revalidatePaths: ['/recruitment'] }
)

// ── Attendance mutations ────────────────────────────────────────────────────

export const checkInProspect = createOrgAuthenticatedAction<
  { eventId: string; prospectId: string },
  void
>(async (supabase, actor, _groupId, input) => {
  const result = await checkInProspectDal(supabase, input.eventId, input.prospectId, actor.personId)
  if (!result.success) throw new Error(result.error)
})

export const removeCheckIn = createOrgAuthenticatedAction<
  { eventId: string; prospectId: string },
  void
>(async (supabase, _actor, _groupId, input) => {
  const result = await removeCheckInDal(supabase, input.eventId, input.prospectId)
  if (!result.success) throw new Error(result.error)
})

// ── Feedback mutations ──────────────────────────────────────────────────────

export const addFeedback = createValidatedOrgAction(
  addFeedbackSchema,
  async (supabase, actor, _groupId, input) => {
    return addFeedbackDal(supabase, {
      prospect_id: input.prospect_id,
      author_person_id: actor.personId,
      body: input.body,
      rating: input.rating,
    })
  }
)

export const deleteFeedback = createOrgAuthenticatedAction<{ feedbackId: string }, void>(
  async (supabase, _actor, _groupId, input) => {
    const result = await deleteFeedbackDal(supabase, input.feedbackId)
    if (!result.success) throw new Error(result.error)
  }
)

export const purgeProspectFeedback = createOrgAuthenticatedAction<{ prospectId: string }, void>(
  async (supabase, _actor, _groupId, input) => {
    const result = await purgeProspectFeedbackDal(supabase, input.prospectId)
    if (!result.success) throw new Error(result.error)
  }
)

export const purgeTermFeedback = createOrgAuthenticatedAction<{ termId: string }, void>(
  async (supabase, _actor, groupId, input) => {
    const result = await purgeTermRecruitmentFeedbackDal(supabase, groupId, input.termId)
    if (!result.success) throw new Error(result.error)
  }
)

// ── Conversion (bid acceptance → roster) ────────────────────────────────────

export const convertProspect = createValidatedOrgAction(
  convertProspectSchema,
  async (supabase, actor, groupId, input) => {
    // Conversion writes via the service role — the gate MUST be app-enforced
    await assertRecruitmentManager(supabase, groupId)

    const result = await convertProspectDal(supabase, groupId, actor.personId, input)

    let claimUrl: string | null = null
    if (result.claimToken) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      claimUrl = `${baseUrl}/claim/${result.claimToken}`
    }

    return { personId: result.personId, claimUrl } as ConvertResult & { claimUrl: string | null }
  },
  { revalidatePaths: ['/recruitment', '/members'] }
)

// ── Bid votes ───────────────────────────────────────────────────────────────

/**
 * One place that knows how to run a bid vote: create the secret ballot,
 * invite every active member, PUBLISH it (a draft poll is un-votable and
 * invisible on dashboards), and link it to the prospect.
 */
async function createBidVoteForProspect(
  supabase: DbClient,
  actor: Actor,
  groupId: string,
  prospect: ProspectCore,
  threshold: number,
  memberIds: string[],
  termId?: string
): Promise<string> {
  // Poll/options/participants inserts are admin-gated in RLS; a rush manager
  // may not be a full admin, so create the ballot through the service role.
  // Callers MUST have run assertRecruitmentManager first.
  const admin = serviceRoleClient()
  const pollId = await createPollDal(admin, groupId, actor.personId, {
    title: `Bid Vote: ${prospect.full_name}`,
    description: prospect.is_legacy
      ? `Legacy bid vote — requires ${Math.round(threshold * 100)}% approval`
      : `Bid vote — requires ${threshold === 1 ? 'unanimous' : `${Math.round(threshold * 100)}%`} approval`,
    voting_method: 'supermajority',
    method_settings: { threshold },
    vote_privacy: 'private',
    allow_abstain: true,
    term_id: termId,
    options: [
      { label: 'Yes', description: 'Extend a bid' },
      { label: 'No', description: 'Do not extend a bid' },
    ],
  })

  await addParticipantsDal(admin, pollId, memberIds)
  await publishPollDal(admin, pollId)
  // The prospect link goes through the scoped client so the prospects audit
  // trigger records the acting rush manager, not the service role.
  await linkPollToProspectDal(supabase, prospect.id, pollId)
  return pollId
}

/** The two threshold values a batch can need, resolved once. */
async function resolveThresholds(supabase: DbClient, groupId: string, needsLegacy: boolean) {
  const standard = await getBidVoteThresholdDal(supabase, groupId, false)
  const legacy = needsLegacy ? await getBidVoteThresholdDal(supabase, groupId, true) : standard
  return { standard, legacy }
}

export const createBidVote = createOrgAuthenticatedAction<
  { prospectId: string; termId?: string },
  string
>(async (supabase, actor, groupId, input) => {
  // Creates the ballot via the service role — the rush gate MUST be app-enforced
  await assertRecruitmentManager(supabase, groupId)

  const [prospect] = await getProspectCoresDal(supabase, [input.prospectId])
  if (!prospect) throw new Error('Prospect not found')
  if (prospect.poll_id) throw new Error('Bid vote already exists for this prospect')

  const threshold = await getBidVoteThresholdDal(supabase, groupId, prospect.is_legacy)
  const memberIds = await getActiveMemberPersonIdsDal(supabase, groupId)

  return createBidVoteForProspect(
    supabase,
    actor,
    groupId,
    prospect,
    threshold,
    memberIds,
    input.termId
  )
})

export const createBatchBidVotes = createOrgAuthenticatedAction<
  { prospectIds: string[]; termId?: string },
  string[]
>(async (supabase, actor, groupId, input) => {
  // Creates ballots via the service role — the rush gate MUST be app-enforced
  await assertRecruitmentManager(supabase, groupId)

  const prospects = (await getProspectCoresDal(supabase, input.prospectIds)).filter(
    (p) => !p.poll_id
  )
  if (prospects.length === 0) return []

  const [memberIds, thresholds] = await Promise.all([
    getActiveMemberPersonIdsDal(supabase, groupId),
    resolveThresholds(
      supabase,
      groupId,
      prospects.some((p) => p.is_legacy)
    ),
  ])

  const pollIds: string[] = []
  for (const prospect of prospects) {
    const threshold = prospect.is_legacy ? thresholds.legacy : thresholds.standard
    pollIds.push(
      await createBidVoteForProspect(
        supabase,
        actor,
        groupId,
        prospect,
        threshold,
        memberIds,
        input.termId
      )
    )
  }

  return pollIds
})

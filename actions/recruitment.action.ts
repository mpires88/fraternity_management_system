'use server'

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
} from '@/dal/recruitment'
import type { DbClient } from '@/dal/types'
import {
  addFeedbackSchema,
  convertProspectSchema,
  createProspectSchema,
  createRecruitmentEventSchema,
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
  const pollId = await createPollDal(supabase, groupId, actor.personId, {
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

  await addParticipantsDal(supabase, pollId, memberIds)
  await publishPollDal(supabase, pollId)
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

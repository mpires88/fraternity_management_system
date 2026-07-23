'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  createAuthenticatedAction,
  createOrgAuthenticatedAction,
  createOrgQueryAction,
} from '@/actions/utils/action-helpers'
import { getBudgetByPollIdDal, ratifyBudgetDal } from '@/dal/budgets'
import { getActiveMemberPersonIdsDal } from '@/dal/members'
import type { CreatePollInput, PollRow } from '@/dal/polls'
import {
  addParticipantsDal,
  archivePollDal,
  castVoteDal,
  closePollDal,
  createPollDal,
  getParticipantCount,
  getParticipantPersonIdsDal,
  getPollById,
  getPollOptions,
  getPollsForGroup,
  getVotesForPoll,
  hasVoted,
  publishPollDal,
} from '@/dal/polls'
import { getProspectByPollIdDal, setProspectStatusDal } from '@/dal/recruitment'
import type { DbClient } from '@/dal/types'
import {
  notifyBudgetRatified,
  notifyPollClosed,
  notifyPollPublished,
} from '@/lib/notifications/triggers'
import type { Database } from '@/lib/supabase/types'
import type { ApprovalMode } from '@/lib/utils/budgets'
import { pollRatifiesFrom } from '@/lib/utils/budgets'
import { calculateResults } from '@/lib/utils/voting/calculator'
import type { PollResult, VoteData } from '@/lib/utils/voting/types'

/**
 * If this poll is a prospect's bid vote, apply the outcome: a ballot that meets
 * its threshold moves the prospect to `offered`; a failed one leaves it a
 * `prospect` (a terminal rejection is a human call). No-op for any other poll
 * since no prospect references it. Best-effort —
 * the poll is already closed, so a flip failure never fails the close; the
 * manual "Offer Bid" control remains as a fallback.
 */
async function applyBidVoteOutcome(supabase: DbClient, poll: PollRow): Promise<void> {
  const prospect = await getProspectByPollIdDal(supabase, poll.id)
  if (prospect?.status !== 'prospect') return

  const [options, votes, participantCount] = await Promise.all([
    getPollOptions(supabase, poll.id),
    getVotesForPoll(supabase, poll.id),
    getParticipantCount(supabase, poll.id),
  ])

  const result = calculateResults(
    poll.voting_method,
    votes.map((v) => v.vote_data as unknown as VoteData),
    options.map((o) => o.id),
    participantCount,
    poll.quorum,
    poll.method_settings as { threshold?: number }
  )

  if (result.passed) {
    await setProspectStatusDal(supabase, prospect.id, 'offered')
  }
}

/**
 * If this poll is a budget's ratification vote, apply the outcome: a passing
 * supermajority ratifies the budget ('vote' mode ratifies from in_review,
 * 'approver_then_vote' from approved — see pollRatifiesFrom). A failed vote
 * leaves the budget where it was; reopening it is a human call. The ratify
 * write goes through the service role because the poll closer (an admin of
 * the approver group) need not be a treasurer of the budget's groups — the
 * gate is the linked poll's verified passing result, and
 * enforce_budget_transition() admits service-role writes. No-op for any
 * other poll. Best-effort: the poll is already closed, a flip failure never
 * fails the close.
 */
async function applyBudgetRatificationOutcome(supabase: DbClient, poll: PollRow): Promise<void> {
  const budget = await getBudgetByPollIdDal(supabase, poll.id)
  if (!budget) return

  const ratifiesFrom = pollRatifiesFrom(budget.approval_mode as ApprovalMode)
  if (!ratifiesFrom || budget.status !== ratifiesFrom) return

  const [options, votes, participantCount] = await Promise.all([
    getPollOptions(supabase, poll.id),
    getVotesForPoll(supabase, poll.id),
    getParticipantCount(supabase, poll.id),
  ])

  const result = calculateResults(
    poll.voting_method,
    votes.map((v) => v.vote_data as unknown as VoteData),
    options.map((o) => o.id),
    participantCount,
    poll.quorum,
    poll.method_settings as { threshold?: number }
  )

  if (!result.passed) return

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const ratified = await ratifyBudgetDal(admin, budget.id, ratifiesFrom)
  if (!ratified.success) return

  try {
    const memberIds = await getActiveMemberPersonIdsDal(supabase, budget.group_id)
    await notifyBudgetRatified(supabase, budget.group_id, budget.title, '/budget', memberIds)
  } catch {
    // Notifications are best-effort
  }
}

export const getPolls = createOrgQueryAction<{ termId?: string }, PollRow[]>(
  async (supabase, _actor, groupId, input) => {
    return getPollsForGroup(supabase, groupId, input.termId)
  }
)

type PollDetailResult = {
  poll: PollRow
  options: { id: string; label: string; description: string | null; sort_order: number }[]
  voted: boolean
  results: PollResult | null
}

export const getPollDetail = createAuthenticatedAction<{ pollId: string }, PollDetailResult>(
  async (supabase, actor, input) => {
    const poll = await getPollById(supabase, input.pollId)
    if (!poll) throw new Error('Poll not found')

    const options = await getPollOptions(supabase, input.pollId)
    const voted = await hasVoted(supabase, input.pollId, actor.personId)

    let results: PollResult | null = null
    if (poll.status === 'closed') {
      const votes = await getVotesForPoll(supabase, input.pollId)
      const participantCount = await getParticipantCount(supabase, input.pollId)
      const ballots = votes.map((v) => v.vote_data as unknown as VoteData)
      const optionIds = options.map((o) => o.id)
      results = calculateResults(
        poll.voting_method,
        ballots,
        optionIds,
        participantCount,
        poll.quorum,
        poll.method_settings as { threshold?: number }
      )
    }

    return { poll, options, voted, results }
  }
)

export const createPoll = createOrgAuthenticatedAction<CreatePollInput, string>(
  async (supabase, actor, groupId, input) => {
    return createPollDal(supabase, groupId, actor.personId, input)
  }
)

export const publishPoll = createOrgAuthenticatedAction<{ pollId: string }, void>(
  async (supabase, actor, groupId, input) => {
    await publishPollDal(supabase, input.pollId)

    const poll = await getPollById(supabase, input.pollId)
    if (poll) {
      const participants = (await getParticipantPersonIdsDal(supabase, input.pollId)).filter(
        (pid) => pid !== actor.personId
      )
      await notifyPollPublished(supabase, groupId, poll.title, '/polls', participants)
    }
  }
)

export const closePoll = createOrgAuthenticatedAction<{ pollId: string }, void>(
  async (supabase, actor, groupId, input) => {
    await closePollDal(supabase, input.pollId)

    const poll = await getPollById(supabase, input.pollId)
    if (poll) {
      // Bid votes drive the recruitment pipeline: a passed vote offers the bid
      await applyBidVoteOutcome(supabase, poll)

      // Budget ratification votes drive the budget lifecycle: a passing
      // supermajority ratifies the linked budget
      await applyBudgetRatificationOutcome(supabase, poll)

      const participants = (await getParticipantPersonIdsDal(supabase, input.pollId)).filter(
        (pid) => pid !== actor.personId
      )
      await notifyPollClosed(supabase, groupId, poll.title, '/polls', participants)
    }
  }
)

export const archivePoll = createOrgAuthenticatedAction<{ pollId: string }, void>(
  async (supabase, _actor, _groupId, input) => {
    await archivePollDal(supabase, input.pollId)
  }
)

export const addParticipants = createOrgAuthenticatedAction<
  { pollId: string; personIds: string[] },
  void
>(async (supabase, _actor, _groupId, input) => {
  await addParticipantsDal(supabase, input.pollId, input.personIds)
})

export const castVote = createAuthenticatedAction<
  { pollId: string; voteData: VoteData; onBehalfOf?: string },
  void
>(async (supabase, actor, input) => {
  const personId = input.onBehalfOf ?? actor.personId
  const castBy = input.onBehalfOf ? actor.personId : undefined
  await castVoteDal(
    supabase,
    input.pollId,
    personId,
    input.voteData as unknown as Record<string, unknown>,
    castBy
  )
})

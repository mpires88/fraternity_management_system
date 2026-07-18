'use server'

import {
  createAuthenticatedAction,
  createOrgAuthenticatedAction,
  createOrgQueryAction,
} from '@/actions/utils/action-helpers'
import type { CreatePollInput, PollRow } from '@/dal/polls'
import {
  addParticipantsDal,
  archivePollDal,
  castVoteDal,
  closePollDal,
  createPollDal,
  getParticipantCount,
  getPollById,
  getPollOptions,
  getPollsForGroup,
  getVotesForPoll,
  hasVoted,
  publishPollDal,
} from '@/dal/polls'
import { calculateResults } from '@/lib/utils/voting/calculator'
import type { PollResult, VoteData } from '@/lib/utils/voting/types'

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
  async (supabase, _actor, _groupId, input) => {
    await publishPollDal(supabase, input.pollId)
  }
)

export const closePoll = createOrgAuthenticatedAction<{ pollId: string }, void>(
  async (supabase, _actor, _groupId, input) => {
    await closePollDal(supabase, input.pollId)
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

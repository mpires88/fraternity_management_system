import type { BallotSummary, PollResult, VoteData } from './types'

function buildSummary(
  ballots: VoteData[],
  eligibleCount: number,
  quorum: number | null
): BallotSummary & { quorumMet: boolean } {
  const abstentions = ballots.filter((b) => b.abstain).length
  const summary: BallotSummary = {
    totalVoters: eligibleCount,
    totalBallots: ballots.length,
    abstentions,
  }
  const quorumMet = quorum === null || ballots.length >= quorum
  return { ...summary, quorumMet }
}

export function plurality(
  ballots: VoteData[],
  optionIds: string[],
  eligibleCount: number,
  quorum: number | null
): PollResult {
  const { quorumMet, ...summary } = buildSummary(ballots, eligibleCount, quorum)
  const tally: Record<string, number> = {}
  for (const id of optionIds) tally[id] = 0

  for (const b of ballots) {
    if (b.abstain || !b.optionId) continue
    if (b.optionId in tally) tally[b.optionId]++
  }

  let winner: string | null = null
  let maxVotes = 0
  for (const [id, count] of Object.entries(tally)) {
    if (count > maxVotes) {
      maxVotes = count
      winner = id
    } else if (count === maxVotes) {
      winner = null
    }
  }

  return { method: 'plurality', winner: quorumMet ? winner : null, summary, tally, quorumMet }
}

export function approval(
  ballots: VoteData[],
  optionIds: string[],
  eligibleCount: number,
  quorum: number | null
): PollResult {
  const { quorumMet, ...summary } = buildSummary(ballots, eligibleCount, quorum)
  const tally: Record<string, number> = {}
  for (const id of optionIds) tally[id] = 0

  for (const b of ballots) {
    if (b.abstain || !b.optionIds) continue
    for (const id of b.optionIds) {
      if (id in tally) tally[id]++
    }
  }

  let winner: string | null = null
  let maxVotes = 0
  for (const [id, count] of Object.entries(tally)) {
    if (count > maxVotes) {
      maxVotes = count
      winner = id
    } else if (count === maxVotes) {
      winner = null
    }
  }

  return { method: 'approval', winner: quorumMet ? winner : null, summary, tally, quorumMet }
}

export function supermajority(
  ballots: VoteData[],
  optionIds: string[],
  eligibleCount: number,
  quorum: number | null,
  threshold = 2 / 3
): PollResult {
  const { quorumMet, ...summary } = buildSummary(ballots, eligibleCount, quorum)
  const tally: Record<string, number> = {}
  for (const id of optionIds) tally[id] = 0

  for (const b of ballots) {
    if (b.abstain || !b.optionId) continue
    if (b.optionId in tally) tally[b.optionId]++
  }

  const nonAbstainCount = ballots.filter((b) => !b.abstain).length

  const yesOption = optionIds[0]
  const yesVotes = tally[yesOption] ?? 0
  const passed = quorumMet && nonAbstainCount > 0 && yesVotes / nonAbstainCount >= threshold

  return {
    method: 'supermajority',
    winner: passed ? yesOption : null,
    summary,
    tally,
    passed,
    quorumMet,
  }
}

export function rcv(
  ballots: VoteData[],
  optionIds: string[],
  eligibleCount: number,
  quorum: number | null
): PollResult {
  const { quorumMet, ...summary } = buildSummary(ballots, eligibleCount, quorum)

  if (!quorumMet) {
    return { method: 'rcv', winner: null, summary, rounds: [], quorumMet }
  }

  const activeBallots = ballots
    .filter((b) => !b.abstain && b.ranking && b.ranking.length > 0)
    .map((b) => [...(b.ranking as string[])])

  let remaining = new Set(optionIds)
  const rounds: { round: number; counts: Record<string, number>; eliminated: string | null }[] = []
  const majority = Math.floor(activeBallots.length / 2) + 1

  for (let round = 1; remaining.size > 1; round++) {
    const counts: Record<string, number> = {}
    for (const id of remaining) counts[id] = 0

    for (const ballot of activeBallots) {
      while (ballot.length > 0 && !remaining.has(ballot[0])) {
        ballot.shift()
      }
      if (ballot.length > 0) {
        counts[ballot[0]]++
      }
    }

    let maxCount = 0
    let minCount = activeBallots.length + 1
    let minCandidate: string | null = null

    for (const [id, count] of Object.entries(counts)) {
      if (count > maxCount) maxCount = count
      if (count < minCount) {
        minCount = count
        minCandidate = id
      }
    }

    if (maxCount >= majority) {
      rounds.push({ round, counts, eliminated: null })
      break
    }

    rounds.push({ round, counts, eliminated: minCandidate })
    if (minCandidate) remaining.delete(minCandidate)

    if (remaining.size <= 1) break
  }

  let winner: string | null = null
  if (remaining.size === 1) {
    winner = [...remaining][0]
  } else if (rounds.length > 0) {
    const lastRound = rounds[rounds.length - 1].counts
    let maxVotes = 0
    for (const [id, count] of Object.entries(lastRound)) {
      if (count > maxVotes) {
        maxVotes = count
        winner = id
      } else if (count === maxVotes) {
        winner = null
      }
    }
  }

  return { method: 'rcv', winner, summary, rounds, quorumMet }
}

export function calculateResults(
  method: string,
  ballots: VoteData[],
  optionIds: string[],
  eligibleCount: number,
  quorum: number | null,
  methodSettings?: { threshold?: number }
): PollResult {
  switch (method) {
    case 'plurality':
      return plurality(ballots, optionIds, eligibleCount, quorum)
    case 'approval':
      return approval(ballots, optionIds, eligibleCount, quorum)
    case 'supermajority':
      return supermajority(ballots, optionIds, eligibleCount, quorum, methodSettings?.threshold)
    case 'rcv':
      return rcv(ballots, optionIds, eligibleCount, quorum)
    default:
      return plurality(ballots, optionIds, eligibleCount, quorum)
  }
}

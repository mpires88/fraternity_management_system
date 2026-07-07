export type VoteData = {
  optionId?: string
  optionIds?: string[]
  ranking?: string[]
  abstain?: boolean
}

export type BallotSummary = {
  totalVoters: number
  totalBallots: number
  abstentions: number
}

export type PollResult = {
  method: string
  winner: string | null
  summary: BallotSummary
  rounds?: RcvRound[]
  tally?: Record<string, number>
  passed?: boolean
  quorumMet: boolean
}

export type RcvRound = {
  round: number
  counts: Record<string, number>
  eliminated: string | null
}

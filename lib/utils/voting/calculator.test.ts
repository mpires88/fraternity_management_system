import { describe, expect, it } from 'vitest'
import { approval, plurality, rcv, supermajority } from './calculator'
import type { VoteData } from './types'

const OPT_A = 'opt-a'
const OPT_B = 'opt-b'
const OPT_C = 'opt-c'
const OPTIONS = [OPT_A, OPT_B, OPT_C]

describe('plurality', () => {
  it('picks the candidate with the most votes', () => {
    const ballots: VoteData[] = [{ optionId: OPT_A }, { optionId: OPT_A }, { optionId: OPT_B }]
    const result = plurality(ballots, OPTIONS, 3, null)
    expect(result.winner).toBe(OPT_A)
    expect(result.tally![OPT_A]).toBe(2)
    expect(result.tally![OPT_B]).toBe(1)
    expect(result.summary.totalBallots).toBe(3)
  })

  it('returns null winner on a tie', () => {
    const ballots: VoteData[] = [{ optionId: OPT_A }, { optionId: OPT_B }]
    const result = plurality(ballots, OPTIONS, 2, null)
    expect(result.winner).toBeNull()
  })

  it('excludes abstentions from tally', () => {
    const ballots: VoteData[] = [{ optionId: OPT_A }, { abstain: true }, { abstain: true }]
    const result = plurality(ballots, OPTIONS, 3, null)
    expect(result.winner).toBe(OPT_A)
    expect(result.tally![OPT_A]).toBe(1)
    expect(result.summary.abstentions).toBe(2)
  })

  it('fails quorum check', () => {
    const ballots: VoteData[] = [{ optionId: OPT_A }]
    const result = plurality(ballots, OPTIONS, 10, 5)
    expect(result.quorumMet).toBe(false)
    expect(result.winner).toBeNull()
  })

  it('passes quorum check', () => {
    const ballots: VoteData[] = Array.from({ length: 5 }, () => ({ optionId: OPT_A }))
    const result = plurality(ballots, OPTIONS, 10, 5)
    expect(result.quorumMet).toBe(true)
    expect(result.winner).toBe(OPT_A)
  })
})

describe('approval', () => {
  it('counts multiple approvals per ballot', () => {
    const ballots: VoteData[] = [
      { optionIds: [OPT_A, OPT_B] },
      { optionIds: [OPT_A, OPT_C] },
      { optionIds: [OPT_B] },
    ]
    const result = approval(ballots, OPTIONS, 3, null)
    expect(result.tally![OPT_A]).toBe(2)
    expect(result.tally![OPT_B]).toBe(2)
    expect(result.tally![OPT_C]).toBe(1)
    // tie between A and B
    expect(result.winner).toBeNull()
  })

  it('picks the single most-approved option', () => {
    const ballots: VoteData[] = [{ optionIds: [OPT_A, OPT_B] }, { optionIds: [OPT_A] }]
    const result = approval(ballots, OPTIONS, 2, null)
    expect(result.winner).toBe(OPT_A)
  })
})

describe('supermajority', () => {
  it('passes with 2/3 threshold', () => {
    // 4 yes out of 5 non-abstain = 80% >= 66.7%
    const ballots: VoteData[] = [
      { optionId: OPT_A },
      { optionId: OPT_A },
      { optionId: OPT_A },
      { optionId: OPT_A },
      { optionId: OPT_B },
    ]
    const result = supermajority(ballots, [OPT_A, OPT_B], 5, null)
    expect(result.passed).toBe(true)
    expect(result.winner).toBe(OPT_A)
  })

  it('fails with insufficient yes votes', () => {
    // 3 yes out of 5 non-abstain = 60% < 66.7%
    const ballots: VoteData[] = [
      { optionId: OPT_A },
      { optionId: OPT_A },
      { optionId: OPT_A },
      { optionId: OPT_B },
      { optionId: OPT_B },
    ]
    const result = supermajority(ballots, [OPT_A, OPT_B], 5, null)
    expect(result.passed).toBe(false)
    expect(result.winner).toBeNull()
  })

  it('abstentions count toward quorum but not threshold denominator', () => {
    // 3 yes, 1 no, 2 abstain = 3/4 non-abstain = 75% >= 66.7%
    // but 6 total ballots for quorum purposes
    const ballots: VoteData[] = [
      { optionId: OPT_A },
      { optionId: OPT_A },
      { optionId: OPT_A },
      { optionId: OPT_B },
      { abstain: true },
      { abstain: true },
    ]
    const result = supermajority(ballots, [OPT_A, OPT_B], 10, 5)
    expect(result.quorumMet).toBe(true)
    expect(result.summary.abstentions).toBe(2)
    expect(result.passed).toBe(true)
  })

  it('respects custom threshold', () => {
    // 3 out of 4 = 75% < 80%
    const ballots: VoteData[] = [
      { optionId: OPT_A },
      { optionId: OPT_A },
      { optionId: OPT_A },
      { optionId: OPT_B },
    ]
    const result = supermajority(ballots, [OPT_A, OPT_B], 4, null, 0.8)
    expect(result.passed).toBe(false)
  })
})

describe('rcv', () => {
  it('wins in the first round with majority', () => {
    const ballots: VoteData[] = [
      { ranking: [OPT_A, OPT_B] },
      { ranking: [OPT_A, OPT_C] },
      { ranking: [OPT_B, OPT_A] },
    ]
    const result = rcv(ballots, OPTIONS, 3, null)
    expect(result.winner).toBe(OPT_A)
    expect(result.rounds!.length).toBe(1)
  })

  it('eliminates lowest and redistributes', () => {
    // Round 1: A=2, B=2, C=1 → C eliminated
    // Round 2: A=2, B=3 (C's voter preferred B) → B wins
    const ballots: VoteData[] = [
      { ranking: [OPT_A, OPT_B] },
      { ranking: [OPT_A, OPT_B] },
      { ranking: [OPT_B, OPT_A] },
      { ranking: [OPT_B, OPT_A] },
      { ranking: [OPT_C, OPT_B] },
    ]
    const result = rcv(ballots, OPTIONS, 5, null)
    expect(result.winner).toBe(OPT_B)
    expect(result.rounds!.length).toBe(2)
    expect(result.rounds![0].eliminated).toBe(OPT_C)
  })

  it('handles abstentions', () => {
    const ballots: VoteData[] = [{ ranking: [OPT_A] }, { ranking: [OPT_A] }, { abstain: true }]
    const result = rcv(ballots, OPTIONS, 3, null)
    expect(result.winner).toBe(OPT_A)
    expect(result.summary.abstentions).toBe(1)
  })

  it('returns no winner when quorum not met', () => {
    const ballots: VoteData[] = [{ ranking: [OPT_A] }]
    const result = rcv(ballots, OPTIONS, 10, 5)
    expect(result.quorumMet).toBe(false)
    expect(result.winner).toBeNull()
    expect(result.rounds).toEqual([])
  })

  it('handles two candidates correctly', () => {
    const ballots: VoteData[] = [{ ranking: [OPT_A] }, { ranking: [OPT_B] }, { ranking: [OPT_B] }]
    const result = rcv(ballots, [OPT_A, OPT_B], 3, null)
    expect(result.winner).toBe(OPT_B)
  })
})

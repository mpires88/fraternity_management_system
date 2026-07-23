import { describe, expect, it } from 'vitest'
import {
  type ApprovalMode,
  type BudgetStatus,
  canCompile,
  canCreateRatificationPoll,
  canManuallyRatify,
  nextBudgetStatuses,
  type ProposalInput,
  pollRatifiesFrom,
  rollupBudget,
  type TransitionContext,
} from './budgets'

function makeProposal(
  overrides: Partial<ProposalInput> & { line_items?: ProposalInput['line_items'] } = {}
): ProposalInput {
  return {
    id: 'p1',
    position_name: 'Treasurer',
    subgroup_name: null,
    status: 'submitted',
    line_items: [],
    ...overrides,
  }
}

function makeCtx(overrides: Partial<TransitionContext> = {}): TransitionContext {
  return {
    allProposalsSubmitted: true,
    pollPassed: false,
    approvalMode: 'approver',
    ...overrides,
  }
}

describe('rollupBudget', () => {
  it('returns zero totals for no proposals', () => {
    const result = rollupBudget([])
    expect(result.grandTotal).toBe(0)
    expect(result.byCategory).toEqual({})
    expect(result.proposals).toEqual([])
  })

  it('sums line items per proposal', () => {
    const result = rollupBudget([
      makeProposal({
        line_items: [
          { amount: 100, category: 'Food', description: 'Pizza' },
          { amount: 50, category: 'Food', description: 'Drinks' },
          { amount: 200, category: 'Supplies', description: 'Decorations' },
        ],
      }),
    ])
    expect(result.proposals[0].total).toBe(350)
    expect(result.proposals[0].byCategory).toEqual({ Food: 150, Supplies: 200 })
    expect(result.grandTotal).toBe(350)
  })

  it('sums decimal currency without float drift', () => {
    // 0.10 + 0.20 → 0.30000000000000004 with naive float addition
    const result = rollupBudget([
      makeProposal({
        line_items: [
          { amount: 0.1, category: 'Food', description: 'A' },
          { amount: 0.2, category: 'Food', description: 'B' },
        ],
      }),
    ])
    expect(result.grandTotal).toBe(0.3)
    expect(result.byCategory).toEqual({ Food: 0.3 })
  })

  it('sums many cent-fraction amounts exactly', () => {
    const result = rollupBudget([
      makeProposal({
        line_items: Array.from({ length: 10 }, (_, i) => ({
          amount: 1.1,
          category: null,
          description: `Item ${i}`,
        })),
      }),
    ])
    expect(result.grandTotal).toBe(11)
  })

  it('aggregates categories across proposals', () => {
    const result = rollupBudget([
      makeProposal({
        id: 'p1',
        line_items: [{ amount: 100, category: 'Food', description: 'A' }],
      }),
      makeProposal({
        id: 'p2',
        position_name: 'Social',
        line_items: [
          { amount: 75, category: 'Food', description: 'B' },
          { amount: 50, category: 'Venue', description: 'C' },
        ],
      }),
    ])
    expect(result.grandTotal).toBe(225)
    expect(result.byCategory).toEqual({ Food: 175, Venue: 50 })
  })

  it('uses "Uncategorized" for null and empty categories', () => {
    const result = rollupBudget([
      makeProposal({
        line_items: [
          { amount: 30, category: null, description: 'Misc' },
          { amount: 20, category: '', description: 'Blank' },
          { amount: 10, category: '   ', description: 'Whitespace' },
        ],
      }),
    ])
    expect(result.byCategory).toEqual({ Uncategorized: 60 })
  })

  it('preserves proposal metadata', () => {
    const result = rollupBudget([
      makeProposal({
        id: 'abc',
        position_name: 'Rush Chair',
        subgroup_name: null,
        status: 'draft',
        line_items: [],
      }),
    ])
    expect(result.proposals[0].proposalId).toBe('abc')
    expect(result.proposals[0].positionName).toBe('Rush Chair')
    expect(result.proposals[0].status).toBe('draft')
  })
})

describe('nextBudgetStatuses', () => {
  it('drafting → in_review when all submitted', () => {
    expect(nextBudgetStatuses('drafting', makeCtx())).toEqual(['in_review', 'archived'])
  })

  it('drafting blocked from in_review when proposals not submitted', () => {
    expect(nextBudgetStatuses('drafting', makeCtx({ allProposalsSubmitted: false }))).toEqual([
      'archived',
    ])
  })

  describe("'approver' mode", () => {
    const mode: ApprovalMode = 'approver'

    it('in_review → drafting or approved', () => {
      expect(nextBudgetStatuses('in_review', makeCtx({ approvalMode: mode }))).toEqual([
        'drafting',
        'approved',
        'archived',
      ])
    })

    it('approved → ratified without any poll', () => {
      expect(nextBudgetStatuses('approved', makeCtx({ approvalMode: mode }))).toEqual([
        'ratified',
        'archived',
      ])
    })
  })

  describe("'vote' mode", () => {
    const mode: ApprovalMode = 'vote'

    it('in_review cannot be approved', () => {
      expect(nextBudgetStatuses('in_review', makeCtx({ approvalMode: mode }))).not.toContain(
        'approved'
      )
    })

    it('in_review → ratified when the poll passed', () => {
      expect(
        nextBudgetStatuses('in_review', makeCtx({ approvalMode: mode, pollPassed: true }))
      ).toEqual(['drafting', 'ratified', 'archived'])
    })

    it('in_review cannot ratify before the poll passes', () => {
      expect(
        nextBudgetStatuses('in_review', makeCtx({ approvalMode: mode, pollPassed: false }))
      ).toEqual(['drafting', 'archived'])
    })

    it('has a reachable path to ratified', () => {
      // Regression: the original machine had no vote-mode route to ratified
      const inReview = nextBudgetStatuses(
        'drafting',
        makeCtx({ approvalMode: mode, allProposalsSubmitted: true })
      )
      expect(inReview).toContain('in_review')
      const ratified = nextBudgetStatuses(
        'in_review',
        makeCtx({ approvalMode: mode, pollPassed: true })
      )
      expect(ratified).toContain('ratified')
    })
  })

  describe("'approver_then_vote' mode", () => {
    const mode: ApprovalMode = 'approver_then_vote'

    it('in_review → approved (never straight to ratified)', () => {
      expect(
        nextBudgetStatuses('in_review', makeCtx({ approvalMode: mode, pollPassed: true }))
      ).toEqual(['drafting', 'approved', 'archived'])
    })

    it('approved → ratified only when the poll passed', () => {
      expect(
        nextBudgetStatuses('approved', makeCtx({ approvalMode: mode, pollPassed: false }))
      ).toEqual(['archived'])
      expect(
        nextBudgetStatuses('approved', makeCtx({ approvalMode: mode, pollPassed: true }))
      ).toEqual(['ratified', 'archived'])
    })
  })

  it('ratified can only archive, in every mode', () => {
    for (const mode of ['approver', 'vote', 'approver_then_vote'] as const) {
      expect(
        nextBudgetStatuses('ratified', makeCtx({ approvalMode: mode, pollPassed: true }))
      ).toEqual(['archived'])
    }
  })

  it('archived has no transitions, in every mode', () => {
    for (const mode of ['approver', 'vote', 'approver_then_vote'] as const) {
      expect(nextBudgetStatuses('archived', makeCtx({ approvalMode: mode }))).toEqual([])
    }
  })
})

describe('canCreateRatificationPoll', () => {
  const cases: Array<[BudgetStatus, ApprovalMode, boolean]> = [
    ['in_review', 'vote', true],
    ['approved', 'approver_then_vote', true],
    ['in_review', 'approver_then_vote', false], // approver must sign off first
    ['approved', 'vote', false], // vote mode never reaches approved
    ['drafting', 'vote', false],
    ['in_review', 'approver', false], // approver mode has no poll
    ['approved', 'approver', false],
    ['ratified', 'vote', false],
  ]
  for (const [status, mode, expected] of cases) {
    it(`${status} + ${mode} → ${expected}`, () => {
      expect(canCreateRatificationPoll(status, mode)).toBe(expected)
    })
  }
})

describe('canManuallyRatify', () => {
  it('only approver mode from approved', () => {
    expect(canManuallyRatify('approved', 'approver')).toBe(true)
    expect(canManuallyRatify('approved', 'vote')).toBe(false)
    expect(canManuallyRatify('approved', 'approver_then_vote')).toBe(false)
    expect(canManuallyRatify('in_review', 'approver')).toBe(false)
    expect(canManuallyRatify('ratified', 'approver')).toBe(false)
  })
})

describe('pollRatifiesFrom', () => {
  it('maps each mode to the status a passing poll ratifies from', () => {
    expect(pollRatifiesFrom('vote')).toBe('in_review')
    expect(pollRatifiesFrom('approver_then_vote')).toBe('approved')
    expect(pollRatifiesFrom('approver')).toBeNull()
  })
})

describe('canCompile', () => {
  it('returns false for no proposals', () => {
    expect(canCompile([])).toBe(false)
  })

  it('returns true when all submitted', () => {
    expect(
      canCompile([
        makeProposal({ id: 'a', status: 'submitted' }),
        makeProposal({ id: 'b', status: 'submitted' }),
      ])
    ).toBe(true)
  })

  it('returns false when any draft', () => {
    expect(
      canCompile([
        makeProposal({ id: 'a', status: 'submitted' }),
        makeProposal({ id: 'b', status: 'draft' }),
      ])
    ).toBe(false)
  })

  it('returns false when any returned', () => {
    expect(
      canCompile([
        makeProposal({ id: 'a', status: 'submitted' }),
        makeProposal({ id: 'b', status: 'returned' }),
      ])
    ).toBe(false)
  })
})

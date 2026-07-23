'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  approveBudget,
  compileBudget,
  createBudgetRatificationPoll,
  createLineItem,
  createProposal,
  deleteLineItem,
  deleteProposal,
  ratifyBudget,
  returnBudgetToDraft,
  returnProposal,
  submitProposal,
  updateLineItem,
} from '@/actions/budgets.action'
import { CommentsSection } from '@/components/comments/comments-section'
import type { BudgetWithProposals, ProposalWithItems } from '@/dal/budgets'
import type { CommentWithAuthor } from '@/dal/documents'
import { canCompile, rollupBudget } from '@/lib/utils/budgets'

const STATUS_COLORS: Record<string, string> = {
  drafting: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300',
  in_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ratified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800/30 dark:text-zinc-500',
}

const STATUS_LABELS: Record<string, string> = {
  drafting: 'Drafting',
  in_review: 'In Review',
  approved: 'Approved',
  ratified: 'Ratified',
  archived: 'Archived',
}

const PROPOSAL_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  returned: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export type PollSummary = {
  status: string
  passed: boolean | null
  approveCount: number
  rejectCount: number
}

type Props = {
  budget: BudgetWithProposals
  canManage: boolean
  personId: string
  groupId: string
  basePath: string
  positions: Array<{ id: string; name: string }>
  subgroups: Array<{ id: string; name: string }>
  myPositionIds: string[]
  comments: CommentWithAuthor[]
  pollSummary: PollSummary | null
}

export function BudgetDetail({
  budget,
  canManage,
  personId,
  groupId,
  basePath,
  positions,
  subgroups,
  myPositionIds,
  comments,
  pollSummary,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pageError, setPageError] = useState<string | null>(null)
  const [showAddProposal, setShowAddProposal] = useState(false)
  const [newProposal, setNewProposal] = useState({ position_id: '', subgroup_id: '' })
  const [expandedProposal, setExpandedProposal] = useState<string | null>(
    budget.proposals.length === 1 ? budget.proposals[0].id : null
  )

  const rollup = rollupBudget(
    budget.proposals.map((p) => ({
      id: p.id,
      position_name: p.position_name,
      subgroup_name: p.subgroup_name,
      status: p.status,
      line_items: p.line_items.map((li) => ({
        amount: li.amount,
        category: li.category,
        description: li.description,
      })),
    }))
  )

  const compilable = canCompile(
    budget.proposals.map((p) => ({
      id: p.id,
      position_name: p.position_name,
      subgroup_name: p.subgroup_name,
      status: p.status,
      line_items: [],
    }))
  )

  const isDrafting = budget.status === 'drafting'
  const isInReview = budget.status === 'in_review'
  const isApproved = budget.status === 'approved'
  const isReadOnly = budget.status === 'ratified' || budget.status === 'archived'
  const mode = budget.approval_mode

  // The vote can be started once every earlier gate is cleared: right after
  // compile in 'vote' mode, only after the approver signs off in
  // 'approver_then_vote' mode. 'approver' mode has no vote.
  const canStartVote =
    !budget.poll_id &&
    ((mode === 'vote' && isInReview) || (mode === 'approver_then_vote' && isApproved))
  // Manual ratification exists only in 'approver' mode; poll-driven budgets
  // are ratified automatically when their vote closes with a passing result
  const canRatifyManually = mode === 'approver' && isApproved

  const pollInThisGroup = (budget.approver_group_id ?? budget.group_id) === groupId

  // Budgeted positions I hold that don't have a proposal yet — my way in
  const proposalPositionIds = new Set(
    budget.proposals.map((p) => p.position_id).filter(Boolean) as string[]
  )
  const myMissingPositions = positions.filter(
    (p) => myPositionIds.includes(p.id) && !proposalPositionIds.has(p.id)
  )

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setPageError(null)
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        router.refresh()
      } else {
        setPageError(result.error ?? 'Something went wrong — please try again')
      }
    })
  }

  async function handleAddProposal(e: React.FormEvent) {
    e.preventDefault()
    run(async () => {
      const result = await createProposal({
        budget_id: budget.id,
        position_id: newProposal.position_id || null,
        subgroup_id: newProposal.subgroup_id || null,
      })
      if (result.success) {
        setShowAddProposal(false)
        setNewProposal({ position_id: '', subgroup_id: '' })
      }
      return result
    })
  }

  return (
    <div className="space-y-6">
      {pageError && (
        <div
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2"
          data-testid="page-error"
        >
          {pageError}
        </div>
      )}

      {/* Status bar + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[budget.status] ?? ''}`}
          >
            {STATUS_LABELS[budget.status] ?? budget.status}
          </span>
          {budget.poll_id && pollSummary && (
            <span className="text-xs text-muted-foreground">
              Ratification vote:{' '}
              {pollSummary.status === 'closed' ? (
                <span
                  className={
                    pollSummary.passed
                      ? 'text-green-600 dark:text-green-400 font-medium'
                      : 'text-red-600 dark:text-red-400 font-medium'
                  }
                >
                  {pollSummary.passed ? 'passed' : 'did not pass'} ({pollSummary.approveCount} for,{' '}
                  {pollSummary.rejectCount} against)
                </span>
              ) : (
                <span>voting in progress</span>
              )}
            </span>
          )}
          {budget.poll_id &&
            (pollInThisGroup ? (
              <a
                href={`${basePath}/polls`}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View ratification vote
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">
                (the vote runs in the approving group)
              </span>
            ))}
        </div>

        {canManage && !isReadOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            {isDrafting && compilable && (
              <button
                type="button"
                onClick={() => run(() => compileBudget({ id: budget.id }))}
                disabled={isPending}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Compile for Review
              </button>
            )}
            {isInReview && mode !== 'vote' && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      'Approve this budget? This is the approving group signing off on the compiled numbers.'
                    )
                  )
                    run(() => approveBudget({ id: budget.id }))
                }}
                disabled={isPending}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
            )}
            {isInReview && (
              <button
                type="button"
                onClick={() => run(() => returnBudgetToDraft({ id: budget.id }))}
                disabled={isPending}
                className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
              >
                Return to Draft
              </button>
            )}
            {canStartVote && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      'Start the ratification vote? Every active member of the approving group gets a ballot, and a 2/3 supermajority ratifies the budget when the vote is closed.'
                    )
                  )
                    run(() => createBudgetRatificationPoll({ id: budget.id }))
                }}
                disabled={isPending}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                Start Ratification Vote
              </button>
            )}
            {canRatifyManually && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      'Ratify this budget? This finalizes it — proposals and line items become read-only.'
                    )
                  )
                    run(() => ratifyBudget({ id: budget.id }))
                }}
                disabled={isPending}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Ratify Budget
              </button>
            )}
            {isApproved && mode !== 'approver' && budget.poll_id && (
              <span className="text-xs text-muted-foreground">
                Ratifies automatically when the vote closes with a passing result
              </span>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Grand Total</div>
          <div className="text-lg font-semibold tabular-nums mt-1">${money(rollup.grandTotal)}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Proposals</div>
          <div className="text-lg font-semibold tabular-nums mt-1">{budget.proposals.length}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Categories</div>
          <div className="text-lg font-semibold tabular-nums mt-1">
            {Object.keys(rollup.byCategory).length}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">By Category</div>
          <div className="mt-1 space-y-0.5">
            {Object.entries(rollup.byCategory)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([cat, amount]) => (
                <div key={cat} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate mr-2">{cat}</span>
                  <span className="tabular-nums font-medium">${money(amount)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* My proposal entry point — position holders add their own proposal */}
      {!canManage && isDrafting && myMissingPositions.length > 0 && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-2">
          <p className="text-sm text-foreground">
            You hold{' '}
            {myMissingPositions.length === 1 ? 'a budgeted position' : 'budgeted positions'} without
            a proposal in this budget yet. Add yours, list your planned expenses, then submit it for
            the treasurer to compile.
          </p>
          <div className="flex gap-2 flex-wrap">
            {myMissingPositions.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    createProposal({
                      budget_id: budget.id,
                      position_id: p.id,
                      subgroup_id: null,
                    })
                  )
                }
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Add my {p.name} proposal
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add proposal (treasurer) */}
      {canManage && isDrafting && (
        <div>
          {showAddProposal ? (
            <form
              onSubmit={handleAddProposal}
              className="rounded-lg border border-border p-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="p-pos" className="text-sm font-medium text-muted-foreground">
                    Position
                  </label>
                  <select
                    id="p-pos"
                    value={newProposal.position_id}
                    onChange={(e) =>
                      setNewProposal({
                        ...newProposal,
                        position_id: e.target.value,
                        subgroup_id: '',
                      })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">General (no position)</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick the officer position this budget area belongs to, or leave as General for a
                    single whole-budget proposal (e.g. a house bill).
                  </p>
                </div>
                {!newProposal.position_id && (
                  <div>
                    <label htmlFor="p-sub" className="text-sm font-medium text-muted-foreground">
                      Subgroup
                    </label>
                    <select
                      id="p-sub"
                      value={newProposal.subgroup_id}
                      onChange={(e) =>
                        setNewProposal({ ...newProposal, subgroup_id: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">None</option>
                      {subgroups.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProposal(false)}
                  className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Add Proposal
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddProposal(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add proposal
            </button>
          )}
        </div>
      )}

      {/* Proposals */}
      {budget.proposals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No proposals yet.{' '}
          {canManage && isDrafting && 'Add a proposal for each budgeted position.'}
        </div>
      ) : (
        <div className="space-y-3">
          {budget.proposals.map((proposal) => {
            const proposalRollup = rollup.proposals.find((p) => p.proposalId === proposal.id)
            return (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                total={proposalRollup?.total ?? 0}
                canManage={canManage}
                isHolder={!!proposal.position_id && myPositionIds.includes(proposal.position_id)}
                budgetStatus={budget.status}
                isExpanded={expandedProposal === proposal.id}
                onToggle={() =>
                  setExpandedProposal(expandedProposal === proposal.id ? null : proposal.id)
                }
                isPending={isPending}
                onRefresh={() => startTransition(() => router.refresh())}
              />
            )
          })}
        </div>
      )}

      {/* Discussion — visible to both the owning and the approving group */}
      <div className="pt-4 border-t border-border">
        <CommentsSection
          resourceType="budget"
          resourceId={budget.id}
          comments={comments}
          personId={personId}
          isAdmin={canManage}
        />
      </div>
    </div>
  )
}

function ProposalCard({
  proposal,
  total,
  canManage,
  isHolder,
  budgetStatus,
  isExpanded,
  onToggle,
  isPending,
  onRefresh,
}: {
  proposal: ProposalWithItems
  total: number
  canManage: boolean
  isHolder: boolean
  budgetStatus: string
  isExpanded: boolean
  onToggle: () => void
  isPending: boolean
  onRefresh: () => void
}) {
  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState({ description: '', amount: '', category: '' })
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState({ description: '', amount: '', category: '' })
  const [returning, setReturning] = useState(false)
  const [returnNote, setReturnNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  // A holder may edit while their proposal is draft OR returned (the revise
  // loop); the treasurer may edit anything while the budget is drafting
  const holderEditable = isHolder && ['draft', 'returned'].includes(proposal.status)
  const canEdit = budgetStatus === 'drafting' && (canManage || holderEditable)
  const canSubmit =
    budgetStatus === 'drafting' &&
    ['draft', 'returned'].includes(proposal.status) &&
    (canManage || isHolder)
  const proposalLabel = proposal.position_name ?? proposal.subgroup_name ?? 'General'

  async function handleSubmit() {
    setActionError(null)
    const result = await submitProposal({ id: proposal.id })
    if (result.success) {
      onRefresh()
    } else {
      setActionError(result.error ?? 'Submit failed')
    }
  }

  async function handleReturn() {
    setActionError(null)
    const result = await returnProposal({
      id: proposal.id,
      notes: returnNote.trim() || null,
    })
    if (result.success) {
      setReturning(false)
      setReturnNote('')
      onRefresh()
    } else {
      setActionError(result.error ?? 'Return failed')
    }
  }

  async function handleDeleteProposal() {
    if (
      !confirm(
        `Delete the "${proposalLabel}" proposal and all its line items? This cannot be undone.`
      )
    )
      return
    setActionError(null)
    const result = await deleteProposal({ id: proposal.id })
    if (result.success) {
      onRefresh()
    } else {
      setActionError(result.error ?? 'Delete failed')
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.description.trim() || !newItem.amount) return
    setActionError(null)
    const result = await createLineItem({
      proposal_id: proposal.id,
      description: newItem.description.trim(),
      amount: Number.parseFloat(newItem.amount),
      category: newItem.category.trim() || null,
    })
    if (result.success) {
      setNewItem({ description: '', amount: '', category: '' })
      setAddingItem(false)
      onRefresh()
    } else {
      setActionError(result.error ?? 'Add failed')
    }
  }

  async function handleSaveItem(itemId: string) {
    setActionError(null)
    const result = await updateLineItem({
      id: itemId,
      description: editItem.description.trim(),
      amount: Number.parseFloat(editItem.amount),
      category: editItem.category.trim() || null,
    })
    if (result.success) {
      setEditingItemId(null)
      onRefresh()
    } else {
      setActionError(result.error ?? 'Unknown error')
    }
  }

  async function handleDeleteItem(itemId: string) {
    setActionError(null)
    const result = await deleteLineItem({ id: itemId })
    if (result.success) {
      onRefresh()
    } else {
      setActionError(result.error ?? 'Unknown error')
    }
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">{proposalLabel}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${PROPOSAL_COLORS[proposal.status] ?? ''}`}
          >
            {proposal.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular-nums">${money(total)}</span>
          <span className="text-xs text-muted-foreground">
            {proposal.line_items.length} item{proposal.line_items.length !== 1 ? 's' : ''}
          </span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {actionError && (
            <div
              className="mx-4 mt-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2"
              data-testid="action-error"
            >
              {actionError}
            </div>
          )}

          {/* Why it was returned — the holder needs the reason to revise */}
          {proposal.status === 'returned' && proposal.notes && (
            <div className="mx-4 mt-2 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded px-3 py-2">
              <span className="font-medium">Returned by the treasurer:</span> {proposal.notes}
            </div>
          )}

          {/* Line items table */}
          {proposal.line_items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Description</th>
                    <th className="text-left px-4 py-2 font-medium">Category</th>
                    <th className="text-right px-4 py-2 font-medium">Amount</th>
                    {canEdit && <th className="w-20 px-4 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {proposal.line_items.map((item) =>
                    editingItemId === item.id ? (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editItem.description}
                            onChange={(e) =>
                              setEditItem({ ...editItem, description: e.target.value })
                            }
                            className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editItem.category}
                            onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}
                            className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editItem.amount}
                            onChange={(e) => setEditItem({ ...editItem, amount: e.target.value })}
                            className="w-24 rounded border border-input bg-background px-2 py-1 text-sm text-right ml-auto block"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleSaveItem(item.id)}
                              disabled={isPending}
                              className="text-xs text-green-600 hover:text-green-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="text-xs text-muted-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={item.id}
                        className="border-t border-border hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2">{item.description}</td>
                        <td className="px-4 py-2 text-muted-foreground">{item.category || '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                          ${money(item.amount)}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-2">
                            <div className="flex gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemId(item.id)
                                  setEditItem({
                                    description: item.description,
                                    amount: String(item.amount),
                                    category: item.category ?? '',
                                  })
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                disabled={isPending}
                                className="text-xs text-red-500 hover:text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Add line item */}
          {canEdit && (
            <div className="px-4 py-3 border-t border-border">
              {addingItem ? (
                <form onSubmit={handleAddItem} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      placeholder="Description (what the money is for)"
                      required
                      aria-label="Line item description"
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="text"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      placeholder="Category"
                      aria-label="Line item category"
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItem.amount}
                      onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                      placeholder="0.00"
                      required
                      aria-label="Line item amount in dollars"
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-right"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPending || !newItem.description.trim() || !newItem.amount}
                    className="px-2 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingItem(false)}
                    className="px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingItem(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  + Add line item
                </button>
              )}
            </div>
          )}

          {/* Return form (treasurer sends the proposal back with a reason) */}
          {returning && (
            <div className="px-4 py-3 border-t border-border space-y-2">
              <label htmlFor={`return-note-${proposal.id}`} className="text-xs font-medium">
                Why is this being returned? The holder sees this note.
              </label>
              <textarea
                id={`return-note-${proposal.id}`}
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                rows={2}
                placeholder="e.g. Trim the social line items — we're $400 over target"
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setReturning(false)}
                  className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReturn}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  Return to Holder
                </button>
              </div>
            </div>
          )}

          {/* Proposal actions */}
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              by {proposal.submitted_by_name}
              {proposal.submitted_at &&
                ` · submitted ${new Date(proposal.submitted_at).toLocaleDateString()}`}
            </div>
            <div className="flex items-center gap-2">
              {canSubmit && proposal.line_items.length > 0 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {proposal.status === 'returned' ? 'Resubmit' : 'Submit'}
                </button>
              )}
              {canManage &&
                proposal.status === 'submitted' &&
                ['drafting', 'in_review'].includes(budgetStatus) &&
                !returning && (
                  <button
                    type="button"
                    onClick={() => setReturning(true)}
                    disabled={isPending}
                    className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Return
                  </button>
                )}
              {canManage && budgetStatus === 'drafting' && (
                <button
                  type="button"
                  onClick={handleDeleteProposal}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

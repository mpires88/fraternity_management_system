'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { archiveBudget, createBudget } from '@/actions/budgets.action'
import type { BudgetRow } from '@/dal/budgets'

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

const APPROVAL_LABELS: Record<string, string> = {
  approver: 'Approver sign-off',
  vote: 'Formal vote',
  approver_then_vote: 'Sign-off + vote',
}

type Props = {
  budgets: BudgetRow[]
  canManage: boolean
  basePath: string
  termId: string
  relatedGroups: Array<{ id: string; name: string }>
}

const MODE_HELP: Record<string, string> = {
  approver: "The approving group's treasurer signs off — no member vote.",
  vote: 'No sign-off step — the approving group votes, and a 2/3 supermajority ratifies.',
  approver_then_vote:
    "The approving group's treasurer signs off first, then their members vote to ratify.",
}

export function BudgetList({ budgets, canManage, basePath, termId, relatedGroups }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [newBudget, setNewBudget] = useState({
    title: '',
    approval_mode: 'approver',
    approver_group_id: '',
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newBudget.title.trim()) return
    setListError(null)
    const result = await createBudget({
      title: newBudget.title.trim(),
      term_id: termId,
      approval_mode: newBudget.approval_mode as 'approver' | 'vote' | 'approver_then_vote',
      approver_group_id: newBudget.approver_group_id || null,
    })
    if (result.success) {
      setShowCreate(false)
      setNewBudget({ title: '', approval_mode: 'approver', approver_group_id: '' })
      startTransition(() => router.refresh())
    } else {
      setListError(result.error ?? 'Could not create the budget — please try again')
    }
  }

  async function handleArchive(budgetId: string) {
    if (!confirm('Archive this budget? It moves to the archived list and can no longer be edited.'))
      return
    setListError(null)
    const result = await archiveBudget({ id: budgetId })
    if (result.success) {
      startTransition(() => router.refresh())
    } else {
      setListError(result.error ?? 'Could not archive the budget')
    }
  }

  const activeBudgets = budgets.filter((b) => b.status !== 'archived')
  const archivedBudgets = budgets.filter((b) => b.status === 'archived')

  return (
    <div className="space-y-6">
      {listError && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
          {listError}
        </div>
      )}
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create Budget
          </button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="b-title" className="text-sm font-medium text-muted-foreground">
                Title *
              </label>
              <input
                id="b-title"
                type="text"
                value={newBudget.title}
                onChange={(e) => setNewBudget({ ...newBudget, title: e.target.value })}
                placeholder="Operating Budget, House Bill, etc."
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="b-mode" className="text-sm font-medium text-muted-foreground">
                Approval mode
              </label>
              <select
                id="b-mode"
                value={newBudget.approval_mode}
                onChange={(e) => setNewBudget({ ...newBudget, approval_mode: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="approver">Approver sign-off</option>
                <option value="vote">Formal vote only</option>
                <option value="approver_then_vote">Sign-off then vote</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {MODE_HELP[newBudget.approval_mode]} This is locked once drafting ends.
              </p>
            </div>
            {relatedGroups.length > 0 && (
              <div>
                <label htmlFor="b-approver" className="text-sm font-medium text-muted-foreground">
                  Approving group
                </label>
                <select
                  id="b-approver"
                  value={newBudget.approver_group_id}
                  onChange={(e) =>
                    setNewBudget({ ...newBudget, approver_group_id: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Own group</option>
                  {relatedGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Who approves this budget — pick the overseeing group (e.g. the housing corp for a
                  house bill) or leave as your own group.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newBudget.title.trim() || isPending}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {activeBudgets.length === 0 && !showCreate ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No budgets for this term. {canManage && 'Click "Create Budget" to start.'}
        </div>
      ) : (
        <div className="space-y-3">
          {activeBudgets.map((budget) => (
            <Link
              key={budget.id}
              href={`${basePath}/budget/${budget.id}`}
              className="block rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{budget.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {APPROVAL_LABELS[budget.approval_mode] ?? budget.approval_mode}
                    {budget.approver_group_id && ' · Cross-group approval'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[budget.status] ?? ''}`}
                  >
                    {STATUS_LABELS[budget.status] ?? budget.status}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        handleArchive(budget.id)
                      }}
                      disabled={isPending}
                      className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {archivedBudgets.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Archived ({archivedBudgets.length})
          </summary>
          <div className="mt-2 space-y-2">
            {archivedBudgets.map((b) => (
              <Link
                key={b.id}
                href={`${basePath}/budget/${b.id}`}
                className="block rounded-lg border border-border/50 p-3 opacity-60 hover:opacity-100 transition-opacity"
              >
                <span className="font-medium">{b.title}</span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

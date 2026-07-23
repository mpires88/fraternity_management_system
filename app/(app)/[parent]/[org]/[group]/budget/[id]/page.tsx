import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BudgetDetail, type PollSummary } from '@/components/budget/budget-detail'
import { PageHeader } from '@/components/ui/page-header'
import { getBudgetDetailDal } from '@/dal/budgets'
import { getCommentsForResource } from '@/dal/documents'
import { getGroupContext } from '@/dal/group-context'
import { getParticipantCount, getPollById, getPollOptions, getVotesForPoll } from '@/dal/polls'
import { getActivePositionHoldersDal, getBudgetedPositionsDal } from '@/dal/positions'
import { getSubgroupsByOrg } from '@/dal/subgroups'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { canManageFromContext } from '@/lib/utils/resolve-permissions'
import { calculateResults } from '@/lib/utils/voting/calculator'
import type { VoteData } from '@/lib/utils/voting/types'

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string; id: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug, id } = await params
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')

  const canManage = canManageFromContext(ctx, 'treasurer')

  const budget = await getBudgetDetailDal(supabase, id)
  if (!budget) redirect(`/${parentSlug}/${orgSlug}/${groupSlug}/budget`)

  const [positions, subgroups, holders, comments] = await Promise.all([
    getBudgetedPositionsDal(supabase, ctx.group.id),
    getSubgroupsByOrg(supabase, ctx.group.id),
    getActivePositionHoldersDal(supabase, ctx.group.id),
    getCommentsForResource(supabase, 'budget', id),
  ])

  const myPositionIds = holders
    .filter((h) => h.person_id === ctx.person.id)
    .map((h) => h.position_id)

  // Linked-poll outcome, computed server-side so the page can show whether
  // the ratification vote passed without a round trip to the polls page
  let pollSummary: PollSummary | null = null
  if (budget.poll_id) {
    const poll = await getPollById(supabase, budget.poll_id)
    if (poll) {
      if (poll.status === 'closed') {
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
        const approveOption = options.find((o) => o.label === 'Approve')
        const rejectOption = options.find((o) => o.label === 'Reject')
        pollSummary = {
          status: poll.status,
          passed: result.passed ?? false,
          approveCount: approveOption ? (result.tally?.[approveOption.id] ?? 0) : 0,
          rejectCount: rejectOption ? (result.tally?.[rejectOption.id] ?? 0) : 0,
        }
      } else {
        pollSummary = { status: poll.status, passed: null, approveCount: 0, rejectCount: 0 }
      }
    }
  }

  const basePath = `/${parentSlug}/${orgSlug}/${groupSlug}`

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`${basePath}/budget`} className="hover:underline">
          Budget
        </Link>
        <span>/</span>
        <span className="text-foreground">{budget.title}</span>
      </div>

      <PageHeader
        title={budget.title}
        description={`${budget.proposals.length} proposal${budget.proposals.length !== 1 ? 's' : ''}`}
        info="Each budgeted position holder fills in and submits their own proposal. The treasurer compiles them for review; the budget is then approved by the approving group, put to a ratification vote, or both, depending on its approval mode."
      />

      <BudgetDetail
        budget={budget}
        canManage={canManage}
        personId={ctx.person.id}
        groupId={ctx.group.id}
        basePath={basePath}
        positions={positions.map((p) => ({ id: p.id, name: p.title }))}
        subgroups={subgroups.map((s) => ({ id: s.id, name: s.name }))}
        myPositionIds={myPositionIds}
        comments={comments}
        pollSummary={pollSummary}
      />
    </div>
  )
}

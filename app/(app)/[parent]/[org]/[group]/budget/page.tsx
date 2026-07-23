import { redirect } from 'next/navigation'
import { BudgetList } from '@/components/budget/budget-list'
import { PageHeader } from '@/components/ui/page-header'
import { getBudgetsForGroupDal } from '@/dal/budgets'
import { getGroupContext } from '@/dal/group-context'
import { getActiveTermDal } from '@/dal/recruitment'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { canManageFromContext } from '@/lib/utils/resolve-permissions'

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug } = await params
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')

  const canManage = canManageFromContext(ctx, 'treasurer')

  const activeTerm = await getActiveTermDal(supabase, ctx.group.id)

  if (!activeTerm) {
    return (
      <div className="p-8">
        <PageHeader
          title="Budget"
          description="No active term. An officer needs to create and activate a term first."
          info="Budgets are organized by term. Each term can have multiple budgets (operating, officer expenses, house bill, etc.) with their own approval workflow."
        />
      </div>
    )
  }

  const budgets = await getBudgetsForGroupDal(supabase, ctx.group.id, activeTerm.id)

  const { data: groupsData } = await supabase
    .from('group_relationships')
    .select(
      'parent_group_id, parent_group:groups!group_relationships_parent_group_id_fkey(id, name)'
    )
    .eq('child_group_id', ctx.group.id)
    .eq('status', 'active')

  const relatedGroups = (groupsData ?? [])
    .map((r) => {
      const g = r.parent_group as unknown as { id: string; name: string } | null
      return g ? { id: g.id, name: g.name } : null
    })
    .filter(Boolean) as Array<{ id: string; name: string }>

  const basePath = `/${parentSlug}/${orgSlug}/${groupSlug}`

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title="Budget"
        description={`${activeTerm.name} — ${budgets.length} budget${budgets.length !== 1 ? 's' : ''}`}
        info="Each budgeted position holder submits line-item proposals. The treasurer compiles, approves, and optionally puts the budget to a formal vote."
      />
      <BudgetList
        budgets={budgets}
        canManage={canManage}
        basePath={basePath}
        termId={activeTerm.id}
        relatedGroups={relatedGroups}
      />
    </div>
  )
}

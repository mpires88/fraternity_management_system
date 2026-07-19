import { redirect } from 'next/navigation'
import { ModulePreview } from '@/components/shared/module-preview'
import { getGroupContext } from '@/dal/group-context'
import { createClient, getAuthUser } from '@/lib/supabase/server'

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

  return (
    <ModulePreview
      title="Budget"
      description="Officer proposals compiled into term budgets, approved your way"
      phase="Phase 11"
      items={[
        {
          label: 'Several budgets per term',
          detail: 'Operating budget, officer expenses, house bill — each its own approval.',
        },
        {
          label: 'Officer proposals',
          detail: 'Each budgeted position submits line items; totals computed live.',
        },
        {
          label: 'Configurable approval',
          detail:
            'Sign-off, formal vote, or both — including cross-group (SNHC approves the house bill).',
        },
        {
          label: 'Discussion',
          detail: 'Threaded comments on every budget, visible to both groups.',
        },
      ]}
    />
  )
}

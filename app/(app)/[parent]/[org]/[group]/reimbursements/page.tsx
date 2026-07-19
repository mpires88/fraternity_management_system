import { redirect } from 'next/navigation'
import { ModulePreview } from '@/components/shared/module-preview'
import { getGroupContext } from '@/dal/group-context'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export default async function ReimbursementsPage({
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
      title="Reimbursements"
      description="Get paid back for what you covered — receipts in, credit or cash out"
      phase="Phase 11"
      items={[
        {
          label: 'Submit with receipts',
          detail: 'Amount, photos, and whose budget it belongs to — any member, not just officers.',
        },
        {
          label: 'Two-stage approval',
          detail: 'The area officer approves, then the treasurer resolves.',
        },
        {
          label: 'Credit or payout',
          detail:
            'Applied against dues and other obligations, or paid out — QuickBooks sync later.',
        },
      ]}
    />
  )
}

import { redirect } from 'next/navigation'
import { ReimbursementList } from '@/components/reimbursements/reimbursement-list'
import { PageHeader } from '@/components/ui/page-header'
import { getGroupContext } from '@/dal/group-context'
import { getActivePositionHoldersDal } from '@/dal/positions'
import { getActiveTermDal } from '@/dal/recruitment'
import { getProposalsForPickerDal, getReimbursementsForGroupDal } from '@/dal/reimbursements'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { canManageFromContext } from '@/lib/utils/resolve-permissions'

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

  const isTreasurer = canManageFromContext(ctx, 'treasurer')

  const activeTerm = await getActiveTermDal(supabase, ctx.group.id)

  const [reimbursements, proposals, holders] = await Promise.all([
    getReimbursementsForGroupDal(supabase, ctx.group.id, activeTerm?.id),
    getProposalsForPickerDal(supabase, ctx.group.id),
    getActivePositionHoldersDal(supabase, ctx.group.id),
  ])

  const myPositionIds = holders
    .filter((h) => h.person_id === ctx.person.id)
    .map((h) => h.position_id)

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title="Reimbursements"
        description={
          activeTerm
            ? `${activeTerm.name} — ${reimbursements.length} request${reimbursements.length !== 1 ? 's' : ''}`
            : 'No active term'
        }
        info="Any member can request reimbursement for expenses. The area officer approves, then the treasurer pays out or applies it as a credit against dues or other obligations."
      />
      <ReimbursementList
        reimbursements={reimbursements}
        isTreasurer={isTreasurer}
        personId={ctx.person.id}
        myPositionIds={myPositionIds}
        proposals={proposals}
        termId={activeTerm?.id ?? null}
      />
    </div>
  )
}

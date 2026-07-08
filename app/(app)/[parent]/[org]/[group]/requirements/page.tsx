import { redirect } from 'next/navigation'
import { ManageRequirements } from '@/components/requirements/manage-requirements'
import { MyRequirements } from '@/components/requirements/my-requirements'
import { PageHeader } from '@/components/ui/page-header'
import { getGroupContext } from '@/dal/group-context'
import { getMyAssignments, getRequirementsForGroup } from '@/dal/requirements'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

export default async function RequirementsPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')
  const perms = resolvePermissionsFromContext(ctx)

  const { data: activeTerm } = await supabase
    .from('terms')
    .select('id, name')
    .eq('group_id', ctx.group.id)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!activeTerm) {
    return (
      <div className="p-8">
        <PageHeader
          title="Requirements"
          description="No active term. An officer needs to create and activate a term in Settings first."
        />
      </div>
    )
  }

  const isAdmin = perms.access_level === 'full'

  const assignments = await getMyAssignments(supabase, ctx.person.id, activeTerm.id)

  let requirements: Awaited<ReturnType<typeof getRequirementsForGroup>> = []
  let roleTypes: { id: string; name: string }[] = []
  let positionsList: { id: string; name: string }[] = []
  let subgroupsList: { id: string; name: string }[] = []
  let otherTerms: { id: string; name: string }[] = []

  if (isAdmin) {
    requirements = await getRequirementsForGroup(supabase, ctx.group.id, activeTerm.id)

    const [rtRes, posRes, sgRes, termsRes] = await Promise.all([
      supabase
        .from('role_types')
        .select('id, name')
        .eq('group_id', ctx.group.id)
        .order('display_order'),
      supabase
        .from('positions')
        .select('id, title')
        .eq('group_id', ctx.group.id)
        .order('display_order'),
      supabase.from('subgroups').select('id, name').eq('group_id', ctx.group.id).order('name'),
      supabase
        .from('terms')
        .select('id, name')
        .eq('group_id', ctx.group.id)
        .neq('id', activeTerm.id)
        .order('year', { ascending: false }),
    ])

    roleTypes = (rtRes.data ?? []).map((r) => ({ id: r.id, name: r.name }))
    positionsList = (posRes.data ?? []).map((p) => ({ id: p.id, name: p.title }))
    subgroupsList = (sgRes.data ?? []).map((s) => ({ id: s.id, name: s.name }))
    otherTerms = (termsRes.data ?? []).map((t) => ({ id: t.id, name: t.name }))
  }

  return (
    <div className="p-8 space-y-10">
      <MyRequirements assignments={assignments} termName={activeTerm.name} />

      {isAdmin && (
        <div className="border-t border-border pt-8">
          <ManageRequirements
            requirements={requirements}
            groupId={ctx.group.id}
            termId={activeTerm.id}
            termName={activeTerm.name}
            roleTypes={roleTypes}
            positions={positionsList}
            subgroups={subgroupsList}
            otherTerms={otherTerms}
          />
        </div>
      )}
    </div>
  )
}

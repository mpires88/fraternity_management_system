import { notFound } from 'next/navigation'
import { OrgBrandingForm } from '@/components/platform-admin/org-branding-form'
import { getParentOrg } from '@/dal/platform-admin'
import { createClient } from '@/lib/supabase/server'

export default async function EditNationalOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const org = await getParentOrg(supabase, id)
  if (!org) notFound()

  return (
    <div className="max-w-2xl">
      <OrgBrandingForm org={org} />
    </div>
  )
}

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Validates the first URL segment exists as either a parent org or standalone org.
 */
export default async function ParentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ parent: string }>
}) {
  const { parent: slug } = await params
  const supabase = await createClient()

  // Check if it's a parent org slug
  const { data: parentOrg } = await supabase
    .from('parent_organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (parentOrg) return <>{children}</>

  // Check if it's a standalone org slug (no parent)
  const { data: standaloneOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .is('parent_organization_id', null)
    .single()

  if (standaloneOrg) return <>{children}</>

  notFound()
}

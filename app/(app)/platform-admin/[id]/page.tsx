import { redirect } from 'next/navigation'

export default async function OldEditRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/platform-admin/national-orgs/${id}`)
}

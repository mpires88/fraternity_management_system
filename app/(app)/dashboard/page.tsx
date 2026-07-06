import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Dashboard</h1>
      <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Logged in as {user.email}</p>
    </div>
  )
}

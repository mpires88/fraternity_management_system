import { NextResponse } from 'next/server'
import { resolvePostLoginRedirect } from '@/dal/orgs'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { email, password } = await request.json()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  const redirect = await resolvePostLoginRedirect(supabase, data.user.id)

  return NextResponse.json({ redirect })
}

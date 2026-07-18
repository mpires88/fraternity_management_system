'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createOptionalAuthAction } from '@/actions/utils/action-helpers'

// Optional-auth on purpose: claiming runs BEFORE persons.auth_user_id is linked,
// so the person-requiring authenticated helpers would reject the caller.
export const claimRecord = createOptionalAuthAction(
  async (_supabase, user, input: { token: string }) => {
    if (!user) {
      return { error: 'You must be signed in to claim an invite' }
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: tokenRow, error: tokenError } = await admin
      .from('claim_tokens')
      .select('id, person_id, expires_at, claimed_at, persons(full_name)')
      .eq('token', input.token)
      .single()

    if (tokenError || !tokenRow) {
      return { error: 'Invalid or expired invite link' }
    }

    if (tokenRow.claimed_at) {
      return { error: 'This invite has already been claimed' }
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return { error: 'This invite has expired' }
    }

    const { data: existingPerson } = await admin
      .from('persons')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (existingPerson) {
      return { error: 'Your account is already linked to a member record' }
    }

    const { error: updateError } = await admin
      .from('persons')
      .update({ auth_user_id: user.id })
      .eq('id', tokenRow.person_id)
      .is('auth_user_id', null)

    if (updateError) {
      return { error: 'Failed to claim record. It may have already been claimed.' }
    }

    await admin
      .from('claim_tokens')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', tokenRow.id)

    return { success: true }
  }
)

'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createOptionalAuthAction } from '@/actions/utils/action-helpers'

function makeAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type ClaimTokenInfo = {
  personName: string
  groupName: string
  expired: boolean
  claimed: boolean
}

/**
 * Server-side token lookup for the /claim/[token] page. claim_tokens has no
 * anon/member read policy (world-readable rows leaked every invite's token
 * and email) — possession of the token itself is the capability, and only
 * display-safe fields leave the server.
 */
export const getClaimTokenInfo = createOptionalAuthAction(
  async (_supabase, _user, input: { token: string }) => {
    const admin = makeAdminClient()

    const { data, error } = await admin
      .from('claim_tokens')
      .select('expires_at, claimed_at, persons(full_name), groups(name)')
      .eq('token', input.token)
      .single()

    if (error || !data) return null

    const persons = data.persons as unknown as { full_name: string } | null
    const groups = data.groups as unknown as { name: string } | null
    return {
      personName: persons?.full_name ?? 'Unknown',
      groupName: groups?.name ?? 'Unknown',
      expired: new Date(data.expires_at) < new Date(),
      claimed: data.claimed_at != null,
    } satisfies ClaimTokenInfo
  }
)

// Optional-auth on purpose: claiming runs BEFORE persons.auth_user_id is linked,
// so the person-requiring authenticated helpers would reject the caller.
export const claimRecord = createOptionalAuthAction(
  async (_supabase, user, input: { token: string }) => {
    if (!user) {
      return { error: 'You must be signed in to claim an invite' }
    }

    const admin = makeAdminClient()

    const { data: tokenRow, error: tokenError } = await admin
      .from('claim_tokens')
      .select('id, person_id, email, expires_at, claimed_at, persons(full_name)')
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

    // Bind the invite to the invited email — without this, anyone holding a
    // leaked token could attach any account to this member record.
    if ((user.email ?? '').toLowerCase() !== tokenRow.email.toLowerCase()) {
      return {
        error:
          'This invite was issued to a different email address. Sign in with the invited email, or ask your chapter admin to reissue the invite.',
      }
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

/**
 * RLS persona suite — proves row-level security against the LIVE dev DB by
 * acting as the three DEV.md personas (all password123):
 *   officer@test.com  — full-access membership
 *   member@test.com   — plain membership
 *   outsider@test.com — valid login, no membership
 *
 * Read-only by design: every write attempted here is one RLS must REJECT.
 * Extend this file as new tables land (PLAN.md task 8.8).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const PASSWORD = 'password123'

function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } })
}

async function login(email: string): Promise<SupabaseClient> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`)
  return client
}

let officer: SupabaseClient
let member: SupabaseClient
let outsider: SupabaseClient
let anon: SupabaseClient

beforeAll(async () => {
  ;[officer, member, outsider] = await Promise.all([
    login('officer@test.com'),
    login('member@test.com'),
    login('outsider@test.com'),
  ])
  anon = anonClient()
})

describe('anonymous', () => {
  it('cannot read claim tokens (8.0)', async () => {
    const { data } = await anon.from('claim_tokens').select('token, email')
    expect(data ?? []).toHaveLength(0)
  })

  it('cannot read persons', async () => {
    const { data } = await anon.from('persons').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('cannot read group memberships', async () => {
    const { data } = await anon.from('group_memberships').select('id')
    expect(data ?? []).toHaveLength(0)
  })
})

describe('outsider (no membership)', () => {
  it('sees no groups', async () => {
    const { data } = await outsider.from('groups').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('sees no requirements', async () => {
    const { data } = await outsider.from('requirements').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('sees no persons except (at most) themself', async () => {
    const { data } = await outsider.from('persons').select('id, auth_user_id')
    const { data: auth } = await outsider.auth.getUser()
    for (const row of data ?? []) {
      expect(row.auth_user_id).toBe(auth.user?.id)
    }
  })

  it('sees no claim tokens', async () => {
    const { data } = await outsider.from('claim_tokens').select('token')
    expect(data ?? []).toHaveLength(0)
  })
})

describe('plain member', () => {
  it('is not a group admin', async () => {
    const { data } = await member.rpc('get_my_admin_group_ids')
    expect(data ?? []).toHaveLength(0)
  })

  it('cannot delete a role type (8.9 config hardening)', async () => {
    const { data: roleTypes } = await member.from('role_types').select('id').limit(1)
    expect(roleTypes?.length).toBe(1)
    const { data: deleted } = await member
      .from('role_types')
      .delete()
      .eq('id', roleTypes![0].id)
      .select('id')
    expect(deleted ?? []).toHaveLength(0)
  })

  it('cannot update a position (8.9 config hardening)', async () => {
    const { data: updated } = await member
      .from('positions')
      .update({ title: 'RLS test should not land' })
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id')
    expect(updated ?? []).toHaveLength(0)
  })

  it('cannot insert a notification for a person outside the group (8.9 binding)', async () => {
    const { data: myGroups } = await member.rpc('get_my_group_ids')
    expect(myGroups?.length).toBeGreaterThan(0)
    // outsider has a persons row but no membership anywhere
    const { data: outsiderAuth } = await outsider.auth.getUser()
    const { data: outsiderPerson } = await outsider
      .from('persons')
      .select('id')
      .eq('auth_user_id', outsiderAuth.user!.id)
      .single()
    const { error } = await member.from('notifications').insert({
      person_id: outsiderPerson!.id,
      group_id: myGroups![0],
      type: 'due_soon',
      title: 'RLS test — must be rejected',
    })
    expect(error).not.toBeNull()
  })

  it("cannot update someone else's assignment", async () => {
    const { data: auth } = await member.auth.getUser()
    const { data: me } = await member
      .from('persons')
      .select('id')
      .eq('auth_user_id', auth.user!.id)
      .single()
    const { data: updated } = await member
      .from('requirement_assignments')
      .update({ status: 'complete' })
      .neq('person_id', me!.id)
      .select('id')
    expect(updated ?? []).toHaveLength(0)
  })

  it('cannot read claim tokens (admin-only)', async () => {
    const { data } = await member.from('claim_tokens').select('token')
    expect(data ?? []).toHaveLength(0)
  })

  it("cannot read other people's sensitive details (8.12)", async () => {
    const { data: auth } = await member.auth.getUser()
    const { data: me } = await member
      .from('persons')
      .select('id')
      .eq('auth_user_id', auth.user!.id)
      .single()
    const { data } = await member.from('person_sensitive_details').select('person_id')
    for (const row of data ?? []) {
      expect(row.person_id).toBe(me!.id)
    }
  })
})

describe('schema-first tables (phases 9–13)', () => {
  it('anon sees none of the new tables', async () => {
    for (const table of ['events', 'prospects', 'budgets', 'issues', 'housing_lotteries']) {
      const { data } = await anon.from(table).select('id')
      expect(data ?? [], table).toHaveLength(0)
    }
  })

  it('outsider sees none of the new tables', async () => {
    for (const table of ['events', 'prospects', 'budgets', 'issues', 'reimbursements']) {
      const { data } = await outsider.from(table).select('id')
      expect(data ?? [], table).toHaveLength(0)
    }
  })

  it('member cannot create a prospect (rush-module gate)', async () => {
    const { data: myGroups } = await member.rpc('get_my_group_ids')
    const { error } = await member.from('prospects').insert({
      group_id: myGroups![0],
      term_id: '00000000-0000-0000-0000-000000000000',
      full_name: 'RLS test — must be rejected',
      added_by: '00000000-0000-0000-0000-000000000000',
    })
    expect(error).not.toBeNull()
  })

  it('member cannot create a budget (treasurer gate)', async () => {
    const { data: myGroups } = await member.rpc('get_my_group_ids')
    const { error } = await member.from('budgets').insert({
      group_id: myGroups![0],
      term_id: '00000000-0000-0000-0000-000000000000',
      created_by: '00000000-0000-0000-0000-000000000000',
    })
    expect(error).not.toBeNull()
  })

  it('member cannot add lottery point adjustments (house-manager gate)', async () => {
    const { data: myGroups } = await member.rpc('get_my_group_ids')
    const { data: auth } = await member.auth.getUser()
    const { data: me } = await member
      .from('persons')
      .select('id')
      .eq('auth_user_id', auth.user!.id)
      .single()
    const { error } = await member.from('housing_point_adjustments').insert({
      group_id: myGroups![0],
      person_id: me!.id,
      amount: 100,
      reason: 'RLS test — must be rejected',
      logged_by: me!.id,
    })
    expect(error).not.toBeNull()
  })

  it('member CAN report an issue; cannot triage it; officer cleans up', async () => {
    const { data: myGroups } = await member.rpc('get_my_group_ids')
    const { data: auth } = await member.auth.getUser()
    const { data: me } = await member
      .from('persons')
      .select('id')
      .eq('auth_user_id', auth.user!.id)
      .single()
    const { data: issue, error } = await member
      .from('issues')
      .insert({
        group_id: myGroups![0],
        kind: 'operations',
        title: 'RLS suite round-trip issue',
        reported_by: me!.id,
      })
      .select('id')
      .single()
    expect(error).toBeNull()

    const { data: updated } = await member
      .from('issues')
      .update({ status: 'acknowledged' })
      .eq('id', issue!.id)
      .select('id')
    expect(updated ?? []).toHaveLength(0)

    const { error: delError } = await officer.from('issues').delete().eq('id', issue!.id)
    expect(delError).toBeNull()
  })

  it('module helper: officer resolves module groups, member resolves none', async () => {
    const { data: officerRush } = await officer.rpc('get_my_module_admin_group_ids', {
      p_module: 'rush',
    })
    expect(officerRush?.length).toBeGreaterThan(0)
    const { data: memberRush } = await member.rpc('get_my_module_admin_group_ids', {
      p_module: 'rush',
    })
    expect(memberRush ?? []).toHaveLength(0)
  })
})

describe('officer (full access)', () => {
  it('is a group admin', async () => {
    const { data } = await officer.rpc('get_my_admin_group_ids')
    expect(data?.length).toBeGreaterThan(0)
  })

  it('resolves organization ids through the rebuilt helper (8.9)', async () => {
    const { data, error } = await officer.rpc('get_my_organization_ids')
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  it("can read group members' sensitive details (8.12)", async () => {
    const { error } = await officer.from('person_sensitive_details').select('person_id').limit(1)
    expect(error).toBeNull()
  })
})

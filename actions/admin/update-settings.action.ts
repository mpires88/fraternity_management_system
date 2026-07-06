'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Org Details ─────────────────────────────────────────────────────────────

export async function updateOrgDetails(input: {
  groupId: string
  name: string
  features: Record<string, boolean>
  parentSlug: string | null
  orgSlug: string
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .update({ name: input.name, features: input.features })
    .eq('id', input.groupId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`${input.parentSlug ? '/' + input.parentSlug : ''}/${input.orgSlug}`)
  return { success: true }
}

// ── Role Types ───────────────────────────────────────────────────────

export async function upsertRoleType(input: {
  id?: string
  groupId: string
  name: string
  slug: string
  access_level: string
  can_vote: boolean
  can_hold_office: boolean
  can_attend_events: boolean
  can_view_roster: boolean
  can_view_financials: boolean
  can_submit_expenses: boolean
  can_view_minutes: boolean
  can_speak_at_meetings: boolean
  can_view_documents: boolean
  color: string | null
  display_order: number
  is_default: boolean
  parentSlug: string | null
  orgSlug: string
}) {
  const supabase = await createClient()
  const { id, parentSlug, orgSlug, groupId, ...fields } = input

  const { error } = id
    ? await supabase
        .from('role_types')
        .update({ ...fields, group_id: groupId })
        .eq('id', id)
    : await supabase.from('role_types').insert({ ...fields, group_id: groupId })

  if (error) return { success: false, error: error.message }

  revalidatePath(`${parentSlug ? '/' + parentSlug : ''}/${orgSlug}/admin`)
  return { success: true }
}

export async function deleteRoleType(input: {
  id: string
  parentSlug: string | null
  orgSlug: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('role_types').delete().eq('id', input.id)

  if (error) return { success: false, error: error.message }

  revalidatePath(`${input.parentSlug ? '/' + input.parentSlug : ''}/${input.orgSlug}/admin`)
  return { success: true }
}

// ── Status Definitions ──────────────────────────────────────────────────────

export async function upsertStatusDefinition(input: {
  id?: string
  groupId: string
  name: string
  slug: string
  description?: string
  color: string | null
  display_order: number
  override_access_level: string | null
  override_can_vote: boolean | null
  override_can_hold_office: boolean | null
  override_can_attend_events: boolean | null
  parentSlug: string | null
  orgSlug: string
}) {
  const supabase = await createClient()
  const { id, parentSlug, orgSlug, groupId, ...fields } = input

  const { error } = id
    ? await supabase
        .from('status_definitions')
        .update({ ...fields, group_id: groupId, is_base: false })
        .eq('id', id)
    : await supabase
        .from('status_definitions')
        .insert({ ...fields, group_id: groupId, is_base: false })

  if (error) return { success: false, error: error.message }

  revalidatePath(`${parentSlug ? '/' + parentSlug : ''}/${orgSlug}/admin`)
  return { success: true }
}

export async function deleteStatusDefinition(input: {
  id: string
  parentSlug: string | null
  orgSlug: string
}) {
  const supabase = await createClient()

  // Can't delete base statuses
  const { data: sd } = await supabase
    .from('status_definitions')
    .select('is_base')
    .eq('id', input.id)
    .single()
  if (sd?.is_base) return { success: false, error: 'Cannot delete base status' }

  const { error } = await supabase.from('status_definitions').delete().eq('id', input.id)

  if (error) return { success: false, error: error.message }

  revalidatePath(`${input.parentSlug ? '/' + input.parentSlug : ''}/${input.orgSlug}/admin`)
  return { success: true }
}

// ── Positions ───────────────────────────────────────────────────────────────

export async function upsertPosition(input: {
  id?: string
  groupId: string
  title: string
  slug: string
  type: string
  permission_level: string
  officer_selection: string
  has_budget: boolean
  display_order: number
  parentSlug: string | null
  orgSlug: string
}) {
  const supabase = await createClient()
  const { id, parentSlug, orgSlug, groupId, ...fields } = input

  const { error } = id
    ? await supabase
        .from('positions')
        .update({ ...fields, group_id: groupId })
        .eq('id', id)
    : await supabase.from('positions').insert({ ...fields, group_id: groupId })

  if (error) return { success: false, error: error.message }

  revalidatePath(`${parentSlug ? '/' + parentSlug : ''}/${orgSlug}/admin`)
  return { success: true }
}

export async function deletePosition(input: {
  id: string
  parentSlug: string | null
  orgSlug: string
}) {
  const supabase = await createClient()
  const { data: pos } = await supabase
    .from('positions')
    .select('is_locked')
    .eq('id', input.id)
    .single()
  if (pos?.is_locked) return { success: false, error: 'Cannot delete locked position' }

  const { error } = await supabase.from('positions').delete().eq('id', input.id)

  if (error) return { success: false, error: error.message }

  revalidatePath(`${input.parentSlug ? '/' + input.parentSlug : ''}/${input.orgSlug}/admin`)
  return { success: true }
}

'use server'

import { createOrgAuthenticatedAction } from '@/actions/utils/action-helpers'
import {
  deletePositionDal,
  deleteRoleTypeDal,
  deleteStatusDefinitionDal,
  updateOrgDetailsDal,
  upsertPositionDal,
  upsertRoleTypeDal,
  upsertStatusDefinitionDal,
} from '@/dal/admin'

// ── Org Details ─────────────────────────────────────────────────────────────

type OrgDetailsInput = {
  name: string
  features: Record<string, boolean>
}

export const updateOrgDetails = createOrgAuthenticatedAction<OrgDetailsInput, void>(
  async (supabase, _user, groupId, input) => updateOrgDetailsDal(supabase, groupId, input)
)

// ── Role Types ───────────────────────────────────────────────────────

type UpsertRoleTypeInput = {
  id?: string
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
}

export const upsertRoleType = createOrgAuthenticatedAction<UpsertRoleTypeInput, void>(
  async (supabase, _user, groupId, input) => upsertRoleTypeDal(supabase, groupId, input)
)

type DeleteByIdInput = { id: string }

export const deleteRoleType = createOrgAuthenticatedAction<DeleteByIdInput, void>(
  async (supabase, _user, _groupId, input) => deleteRoleTypeDal(supabase, input.id)
)

// ── Status Definitions ──────────────────────────────────────────────────────

type UpsertStatusInput = {
  id?: string
  name: string
  slug: string
  description?: string
  color: string | null
  display_order: number
  override_access_level: string | null
  override_can_vote: boolean | null
  override_can_hold_office: boolean | null
  override_can_attend_events: boolean | null
}

export const upsertStatusDefinition = createOrgAuthenticatedAction<UpsertStatusInput, void>(
  async (supabase, _user, groupId, input) => upsertStatusDefinitionDal(supabase, groupId, input)
)

export const deleteStatusDefinition = createOrgAuthenticatedAction<DeleteByIdInput, void>(
  async (supabase, _user, _groupId, input) => deleteStatusDefinitionDal(supabase, input.id)
)

// ── Positions ───────────────────────────────────────────────────────────────

type UpsertPositionInput = {
  id?: string
  title: string
  slug: string
  type: string
  permission_level: string
  officer_selection: string
  has_budget: boolean
  display_order: number
}

export const upsertPosition = createOrgAuthenticatedAction<UpsertPositionInput, void>(
  async (supabase, _user, groupId, input) => upsertPositionDal(supabase, groupId, input)
)

export const deletePosition = createOrgAuthenticatedAction<DeleteByIdInput, void>(
  async (supabase, _user, _groupId, input) => deletePositionDal(supabase, input.id)
)

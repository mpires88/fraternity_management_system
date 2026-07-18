/**
 * Domain types — kept in sync with the database schema.
 * When supabase gen types is run, these should match the generated output.
 * Use these for component props, DAL return types, and context shapes.
 */

export type ParentOrganization = {
  id: string
  name: string
  slug: string
  abbreviation: string | null
  org_type: string
  logo_url: string | null
  website: string | null
}

export type Org = {
  id: string
  parent_organization_id: string | null
  name: string
  slug: string
  org_type: string
  features: Partial<OrgFeatures>
  settings: Record<string, unknown>
  terminology: Record<string, string>
  logo_url: string | null
  created_at: string
}

export type OrgFeatures = {
  members: boolean
  announcements: boolean
  documents: boolean
  meetings: boolean
  events: boolean
  budget: boolean
  dues: boolean
  elections: boolean
  voting: boolean
  house: boolean
  rush: boolean
  tasks: boolean
  subgroups: boolean
}

// DOB / address / emergency contact live in person_sensitive_details
// (self + shared-group admins only) — not on the widely-readable persons row.
export type Person = {
  id: string
  full_name: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  preferred_name: string | null
  school_email: string
  phone: string | null
  personal_email: string | null
  profile_photo: string | null
  bio: string | null
  nickname: string | null
  big_id: string | null
  initiation_date: string | null
  bid_date: string | null
  member_number: string | null
  expected_grad_year: number | null
  major: string | null
  created_at: string
}

export type RoleType = {
  id: string
  group_id: string
  name: string
  slug: string
  description: string | null
  is_default: boolean
  access_level: 'full' | 'limited' | 'read_only' | 'none'
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
  display_order: number | null
}

export type StatusDefinition = {
  id: string
  group_id: string | null
  name: string
  slug: string
  description: string | null
  is_base: boolean
  override_access_level: string | null
  override_can_vote: boolean | null
  override_can_hold_office: boolean | null
  override_can_attend_events: boolean | null
  override_can_view_roster: boolean | null
  override_can_view_financials: boolean | null
  override_can_submit_expenses: boolean | null
  override_can_view_minutes: boolean | null
  override_can_speak_at_meetings: boolean | null
  override_can_view_documents: boolean | null
  color: string | null
  display_order: number | null
}

/** @deprecated Use RoleType instead */
export type MembershipType = RoleType

export type OrgMembership = {
  id: string
  person_id: string
  group_id: string
  role_type_id: string | null
  status_id: string | null
  chapter_email: string | null
  joined_at: string | null
  started_at: string | null
  ended_at: string | null
  notes: string | null
}

export type Term = {
  id: string
  group_id: string
  definition_id: string
  name: string
  year: number
  starts_on: string
  ends_on: string
  status: 'upcoming' | 'active' | 'completed'
  has_elections: boolean
  has_budget: boolean
  has_rollover: boolean
  has_rush: boolean
  officer_selection: string
}

export type Position = {
  id: string
  group_id: string
  title: string
  slug: string
  system_role_id: string | null
  type: 'exec' | 'committee' | 'house' | 'board' | 'other' | null
  permission_level: 'exec' | 'officer' | null
  max_holders: number
  has_budget: boolean
  is_presiding_officer: boolean
  semester_scope: string[] | null
  officer_selection: string | null
  is_locked: boolean
  can_rename: boolean
  display_order: number | null
}

export type Subgroup = {
  id: string
  group_id: string
  name: string
  slug: string
  subgroup_type:
    | 'committee'
    | 'exec_board'
    | 'new_member_class'
    | 'house_residents'
    | 'ad_hoc'
    | 'family_line'
    | 'advisory_board'
    | null
  membership_type: 'appointed' | 'elected' | 'open' | 'invite_only' | 'automatic' | null
  head_position_id: string | null
  is_private: boolean
  is_locked: boolean
  can_rename: boolean
}

/** Effective permissions after applying status overrides to role type */
export type EffectivePermissions = {
  can_vote: boolean
  can_hold_office: boolean
  can_attend_events: boolean
  can_view_roster: boolean
  can_view_financials: boolean
  can_submit_expenses: boolean
  can_view_minutes: boolean
  can_speak_at_meetings: boolean
  can_view_documents: boolean
  access_level: 'full' | 'limited' | 'read_only' | 'none'
}

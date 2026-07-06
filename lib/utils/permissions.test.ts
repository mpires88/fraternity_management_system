import { describe, expect, it } from 'vitest'
import { getEffectivePermissions } from './permissions'

const memberRole = {
  access_level: 'full',
  can_vote: true,
  can_hold_office: true,
  can_attend_events: true,
  can_view_roster: true,
  can_view_financials: true,
  can_submit_expenses: true,
  can_view_minutes: true,
  can_speak_at_meetings: true,
  can_view_documents: true,
}

const advisorRole = {
  ...memberRole,
  access_level: 'limited',
  can_vote: false,
  can_hold_office: false,
  can_submit_expenses: false,
}

// Active status = null overrides (no restrictions)
const activeStatus = {
  override_access_level: null,
  override_can_vote: null,
  override_can_hold_office: null,
  override_can_attend_events: null,
  override_can_view_roster: null,
  override_can_view_financials: null,
  override_can_submit_expenses: null,
  override_can_view_minutes: null,
  override_can_speak_at_meetings: null,
  override_can_view_documents: null,
}

describe('getEffectivePermissions', () => {
  it('returns role permissions when no status overrides', () => {
    const perms = getEffectivePermissions(memberRole)
    expect(perms.can_vote).toBe(true)
    expect(perms.can_hold_office).toBe(true)
    expect(perms.access_level).toBe('full')
  })

  it('returns role permissions when active status (all null overrides)', () => {
    const perms = getEffectivePermissions(memberRole, activeStatus)
    expect(perms.can_vote).toBe(true)
    expect(perms.can_hold_office).toBe(true)
    expect(perms.access_level).toBe('full')
  })

  it('probated status restricts vote and office', () => {
    const probated = { ...activeStatus, override_can_vote: false, override_can_hold_office: false }
    const perms = getEffectivePermissions(memberRole, probated)
    expect(perms.can_vote).toBe(false)
    expect(perms.can_hold_office).toBe(false)
    expect(perms.can_attend_events).toBe(true) // not overridden
    expect(perms.access_level).toBe('full') // not overridden
  })

  it('alumni status downgrades access level', () => {
    const alumni = {
      ...activeStatus,
      override_access_level: 'read_only',
      override_can_vote: false,
      override_can_hold_office: false,
    }
    const perms = getEffectivePermissions(memberRole, alumni)
    expect(perms.access_level).toBe('read_only')
    expect(perms.can_vote).toBe(false)
    expect(perms.can_attend_events).toBe(true) // not overridden
  })

  it('expelled status removes all permissions', () => {
    const expelled = {
      override_access_level: 'none',
      override_can_vote: false,
      override_can_hold_office: false,
      override_can_attend_events: false,
      override_can_view_roster: false,
      override_can_view_financials: false,
      override_can_submit_expenses: false,
      override_can_view_minutes: false,
      override_can_speak_at_meetings: false,
      override_can_view_documents: false,
    }
    const perms = getEffectivePermissions(memberRole, expelled)
    expect(perms.access_level).toBe('none')
    expect(perms.can_vote).toBe(false)
    expect(perms.can_attend_events).toBe(false)
    expect(perms.can_view_documents).toBe(false)
  })

  it('status cannot grant permissions the role does not have', () => {
    // Advisor can't vote. Even if status somehow says override_can_vote=true, it stays false.
    const weirdStatus = { ...activeStatus, override_can_vote: true }
    const perms = getEffectivePermissions(advisorRole, weirdStatus)
    expect(perms.can_vote).toBe(false) // advisor base is false, override=true doesn't upgrade
  })

  it('access level cannot be upgraded by status', () => {
    // Advisor has 'limited'. Status trying to override to 'full' should keep 'limited'.
    const upgradeAttempt = { ...activeStatus, override_access_level: 'full' }
    const perms = getEffectivePermissions(advisorRole, upgradeAttempt)
    expect(perms.access_level).toBe('limited') // can't upgrade
  })

  it('respects advisor base permissions without overrides', () => {
    const perms = getEffectivePermissions(advisorRole, activeStatus)
    expect(perms.can_vote).toBe(false)
    expect(perms.can_hold_office).toBe(false)
    expect(perms.can_view_financials).toBe(true) // advisor can see financials
    expect(perms.access_level).toBe('limited')
  })
})

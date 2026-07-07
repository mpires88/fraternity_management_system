import { describe, expect, it } from 'vitest'
import { type AudienceContext, type AudienceSpec, expandAudience } from './requirements'

const ROLE_ACTIVE = 'role-active'
const ROLE_CANDIDATE = 'role-candidate'
const POS_COMMANDER = 'pos-commander'
const POS_TREASURER = 'pos-treasurer'
const SUB_PLEDGES = 'sub-pledges'
const SUB_EXEC = 'sub-exec'

const ALICE = 'person-alice'
const BOB = 'person-bob'
const CAROL = 'person-carol'
const DAN = 'person-dan'
const EVE = 'person-eve'

const ctx: AudienceContext = {
  members: [
    { person_id: ALICE, role_type_id: ROLE_ACTIVE, status_slug: 'active' },
    { person_id: BOB, role_type_id: ROLE_ACTIVE, status_slug: 'active' },
    { person_id: CAROL, role_type_id: ROLE_CANDIDATE, status_slug: 'active' },
    { person_id: DAN, role_type_id: ROLE_ACTIVE, status_slug: 'expelled' },
    { person_id: EVE, role_type_id: ROLE_ACTIVE, status_slug: 'away' },
  ],
  positionHolders: [
    { person_id: ALICE, position_id: POS_COMMANDER },
    { person_id: BOB, position_id: POS_TREASURER },
  ],
  subgroupMembers: [
    { person_id: CAROL, subgroup_id: SUB_PLEDGES },
    { person_id: ALICE, subgroup_id: SUB_EXEC },
    { person_id: BOB, subgroup_id: SUB_EXEC },
  ],
}

describe('expandAudience', () => {
  it('all_active returns every non-expelled member', () => {
    const spec: AudienceSpec = { assign_to: 'all_active' }
    const result = expandAudience(spec, ctx)
    expect(result).toHaveLength(4)
    expect(result).toContain(ALICE)
    expect(result).toContain(BOB)
    expect(result).toContain(CAROL)
    expect(result).toContain(EVE)
    expect(result).not.toContain(DAN)
  })

  it('role_types filters by role type IDs', () => {
    const spec: AudienceSpec = {
      assign_to: 'role_types',
      audience_role_type_ids: [ROLE_CANDIDATE],
    }
    const result = expandAudience(spec, ctx)
    expect(result).toEqual([CAROL])
  })

  it('role_types with multiple IDs returns union', () => {
    const spec: AudienceSpec = {
      assign_to: 'role_types',
      audience_role_type_ids: [ROLE_ACTIVE, ROLE_CANDIDATE],
    }
    const result = expandAudience(spec, ctx)
    expect(result).toHaveLength(4)
    expect(result).toContain(ALICE)
    expect(result).toContain(BOB)
    expect(result).toContain(CAROL)
    expect(result).toContain(EVE)
    expect(result).not.toContain(DAN)
  })

  it('positions resolves current holders', () => {
    const spec: AudienceSpec = {
      assign_to: 'positions',
      audience_position_ids: [POS_COMMANDER],
    }
    const result = expandAudience(spec, ctx)
    expect(result).toEqual([ALICE])
  })

  it('positions with multiple IDs returns union', () => {
    const spec: AudienceSpec = {
      assign_to: 'positions',
      audience_position_ids: [POS_COMMANDER, POS_TREASURER],
    }
    const result = expandAudience(spec, ctx)
    expect(result).toHaveLength(2)
    expect(result).toContain(ALICE)
    expect(result).toContain(BOB)
  })

  it('subgroups resolves subgroup members', () => {
    const spec: AudienceSpec = {
      assign_to: 'subgroups',
      audience_subgroup_ids: [SUB_PLEDGES],
    }
    const result = expandAudience(spec, ctx)
    expect(result).toEqual([CAROL])
  })

  it('subgroups with multiple IDs dedupes across subgroups', () => {
    const spec: AudienceSpec = {
      assign_to: 'subgroups',
      audience_subgroup_ids: [SUB_PLEDGES, SUB_EXEC],
    }
    const result = expandAudience(spec, ctx)
    expect(result).toHaveLength(3)
    expect(result).toContain(ALICE)
    expect(result).toContain(BOB)
    expect(result).toContain(CAROL)
  })

  it('custom returns exactly the specified person IDs', () => {
    const spec: AudienceSpec = {
      assign_to: 'custom',
      custom_person_ids: [BOB, EVE],
    }
    const result = expandAudience(spec, ctx)
    expect(result).toHaveLength(2)
    expect(result).toContain(BOB)
    expect(result).toContain(EVE)
  })

  it('custom deduplicates', () => {
    const spec: AudienceSpec = {
      assign_to: 'custom',
      custom_person_ids: [ALICE, ALICE, BOB],
    }
    const result = expandAudience(spec, ctx)
    expect(result).toHaveLength(2)
  })

  it('role_types excludes expelled members', () => {
    const spec: AudienceSpec = {
      assign_to: 'role_types',
      audience_role_type_ids: [ROLE_ACTIVE],
    }
    const result = expandAudience(spec, ctx)
    expect(result).not.toContain(DAN)
    expect(result).toHaveLength(3)
  })

  it('returns empty when no audience IDs provided', () => {
    const spec: AudienceSpec = { assign_to: 'role_types', audience_role_type_ids: [] }
    expect(expandAudience(spec, ctx)).toEqual([])
  })
})

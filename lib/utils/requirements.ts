type Member = { person_id: string; role_type_id: string | null; status_slug: string }
type PositionHolder = { person_id: string; position_id: string }
type SubgroupMember = { person_id: string; subgroup_id: string }

export type AudienceContext = {
  members: Member[]
  positionHolders: PositionHolder[]
  subgroupMembers: SubgroupMember[]
}

export type AudienceSpec = {
  assign_to: 'all_active' | 'role_types' | 'positions' | 'subgroups' | 'custom'
  audience_role_type_ids?: string[] | null
  audience_position_ids?: string[] | null
  audience_subgroup_ids?: string[] | null
  custom_person_ids?: string[] | null
}

export function expandAudience(spec: AudienceSpec, ctx: AudienceContext): string[] {
  const activeMembers = ctx.members.filter((m) => m.status_slug !== 'expelled')

  switch (spec.assign_to) {
    case 'all_active':
      return dedupe(activeMembers.map((m) => m.person_id))

    case 'role_types': {
      const ids = new Set(spec.audience_role_type_ids ?? [])
      return dedupe(
        activeMembers
          .filter((m) => m.role_type_id && ids.has(m.role_type_id))
          .map((m) => m.person_id)
      )
    }

    case 'positions': {
      const ids = new Set(spec.audience_position_ids ?? [])
      return dedupe(
        ctx.positionHolders.filter((h) => ids.has(h.position_id)).map((h) => h.person_id)
      )
    }

    case 'subgroups': {
      const ids = new Set(spec.audience_subgroup_ids ?? [])
      return dedupe(
        ctx.subgroupMembers.filter((m) => ids.has(m.subgroup_id)).map((m) => m.person_id)
      )
    }

    case 'custom':
      return dedupe(spec.custom_person_ids ?? [])
  }
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)]
}

import type { DbClient } from '@/dal/types'
import type { UpdateProfileInput } from '@/lib/validations/profile'

export type PersonProfile = {
  id: string
  full_name: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  preferred_name: string | null
  school_email: string
  phone: string | null
  personal_email: string | null
  street_address: string | null
  city: string | null
  state: string | null
  country: string | null
  emergency_contact_relationship: string | null
  profile_photo: string | null
  bio: string | null
  nickname: string | null
  date_of_birth: string | null
  initiation_date: string | null
  bid_date: string | null
  member_number: string | null
  expected_grad_year: number | null
  major: string | null
  created_at: string
  big: {
    id: string
    full_name: string
    nickname: string | null
    profile_photo: string | null
    big: {
      id: string
      full_name: string
      nickname: string | null
      profile_photo: string | null
    } | null
  } | null
  littles: {
    id: string
    full_name: string
    nickname: string | null
    profile_photo: string | null
    littles: {
      id: string
      full_name: string
      nickname: string | null
      profile_photo: string | null
    }[]
  }[]
  emergency_contact: {
    id: string
    full_name: string
    phone: string | null
    relationship: string | null
  } | null
  family_line: { id: string; name: string } | null
  membership: {
    id: string
    status: string
    role_type_id: string | null
    status_id: string | null
    joined_at: string | null
    chapter_email: string | null
    notes: string | null
    role_type: {
      id: string
      name: string
      slug: string
      color: string | null
      access_level: string
    }
    status_definition: {
      id: string
      name: string
      slug: string
      color: string | null
      is_base: boolean
    }
    /** @deprecated Use role_type */
    membership_type: {
      id: string
      name: string
      slug: string
      color: string | null
      access_level: string
    }
  }
  positions: {
    id: string
    title: string
    slug: string
    type: string | null
    term_name: string
    term_start: string | null
    term_end: string | null
    is_acting: boolean
  }[]
}

/**
 * Loads a full member profile by person ID within an org.
 */
export async function getPersonProfile(
  supabase: DbClient,
  personId: string,
  groupId: string
): Promise<PersonProfile | null> {
  // Person record
  const { data: person } = await supabase.from('persons').select('*').eq('id', personId).single()

  if (!person) return null

  // Membership in this org
  const { data: membership } = await supabase
    .from('group_memberships')
    .select(
      '*, role_types(id, name, slug, color, access_level), status_definitions(id, name, slug, color, is_base)'
    )
    .eq('person_id', personId)
    .eq('group_id', groupId)
    .single()

  if (!membership) return null

  // Big brother
  let big: PersonProfile['big'] = null
  if (person.big_id) {
    const { data: bigData } = await supabase
      .from('persons')
      .select('id, full_name, nickname, profile_photo, big_id')
      .eq('id', person.big_id)
      .single()
    if (bigData) {
      // Fetch grandbig
      let grandbig: {
        id: string
        full_name: string
        nickname: string | null
        profile_photo: string | null
      } | null = null
      if (bigData.big_id) {
        const { data: gbData } = await supabase
          .from('persons')
          .select('id, full_name, nickname, profile_photo')
          .eq('id', bigData.big_id)
          .single()
        if (gbData) grandbig = gbData
      }
      big = {
        id: bigData.id,
        full_name: bigData.full_name,
        nickname: bigData.nickname,
        profile_photo: bigData.profile_photo,
        big: grandbig,
      }
    }
  }

  // Littles + their littles (grandlittles)
  const { data: littlesRaw } = await supabase
    .from('persons')
    .select('id, full_name, nickname, profile_photo')
    .eq('big_id', personId)

  const littlesData: PersonProfile['littles'] = []
  for (const l of littlesRaw ?? []) {
    const { data: grandlittles } = await supabase
      .from('persons')
      .select('id, full_name, nickname, profile_photo')
      .eq('big_id', l.id)
    littlesData.push({
      ...l,
      littles: (grandlittles ?? []) as PersonProfile['littles'][0]['littles'],
    })
  }

  // Emergency contact (FK to another person)
  let emergencyContact: PersonProfile['emergency_contact'] = null
  if (person.emergency_contact_person_id) {
    const { data: ecPerson } = await supabase
      .from('persons')
      .select('id, full_name, phone')
      .eq('id', person.emergency_contact_person_id)
      .single()
    if (ecPerson) {
      emergencyContact = {
        id: ecPerson.id,
        full_name: ecPerson.full_name,
        phone: ecPerson.phone,
        relationship: person.emergency_contact_relationship,
      }
    }
  }

  // Family line (from subgroup membership)
  let familyLine: PersonProfile['family_line'] = null
  const { data: familySubgroup } = await supabase
    .from('subgroup_members')
    .select('subgroups(id, name)')
    .eq('person_id', personId)
    .eq('subgroups.subgroup_type', 'family_line')
    .limit(1)
    .single()
  if (familySubgroup?.subgroups) {
    const sg = familySubgroup.subgroups as { id: string; name: string }
    familyLine = { id: sg.id, name: sg.name }
  }

  // Position assignments
  const { data: posData } = await supabase
    .from('position_assignments')
    .select('id, term_start, term_end, is_acting, positions(title, slug, type), terms(name)')
    .eq('person_id', personId)
    .eq('group_id', groupId)
    .order('term_start', { ascending: false })

  const positions = (posData ?? []).map((pa: Record<string, unknown>) => {
    const pos = pa.positions as { title: string; slug: string; type: string | null }
    const term = pa.terms as { name: string }
    return {
      id: pa.id as string,
      title: pos.title,
      slug: pos.slug,
      type: pos.type,
      term_name: term.name,
      term_start: pa.term_start as string | null,
      term_end: pa.term_end as string | null,
      is_acting: pa.is_acting as boolean,
    }
  })

  const at = membership.role_types as {
    id: string
    name: string
    slug: string
    color: string | null
    access_level: string
  }
  const sd = membership.status_definitions as {
    id: string
    name: string
    slug: string
    color: string | null
    is_base: boolean
  }

  return {
    id: person.id,
    full_name: person.full_name,
    first_name: person.first_name,
    middle_name: person.middle_name,
    last_name: person.last_name,
    preferred_name: person.preferred_name,
    school_email: person.school_email,
    phone: person.phone,
    personal_email: person.personal_email,
    street_address: person.street_address,
    city: person.city,
    state: person.state,
    country: person.country,
    emergency_contact_relationship: person.emergency_contact_relationship,
    profile_photo: person.profile_photo,
    bio: person.bio,
    nickname: person.nickname,
    date_of_birth: person.date_of_birth,
    initiation_date: person.initiation_date,
    bid_date: person.bid_date,
    member_number: person.member_number,
    expected_grad_year: person.expected_grad_year,
    major: person.major,
    created_at: person.created_at ?? new Date().toISOString(),
    big,
    littles: littlesData,
    emergency_contact: emergencyContact,
    family_line: familyLine,
    membership: {
      id: membership.id,
      status: sd?.slug ?? 'active',
      role_type_id: membership.role_type_id,
      status_id: membership.status_id,
      joined_at: membership.joined_at,
      chapter_email: membership.chapter_email,
      notes: membership.notes,
      role_type: at,
      status_definition: sd,
      membership_type: at, // backwards compat
    },
    positions,
  }
}

const SELF_EDITABLE_FIELDS = [
  'preferred_name',
  'nickname',
  'personal_email',
  'phone',
  'bio',
  'street_address',
  'city',
  'state',
  'country',
  'profile_photo',
] as const

export async function updateMyProfile(
  supabase: DbClient,
  personId: string,
  fields: UpdateProfileInput
): Promise<void> {
  const update: Record<string, unknown> = {}
  for (const key of SELF_EDITABLE_FIELDS) {
    if (fields[key] !== undefined) update[key] = fields[key]
  }
  if (Object.keys(update).length === 0) return
  const { error } = await supabase.from('persons').update(update).eq('id', personId)
  if (error) throw new Error(error.message)
}

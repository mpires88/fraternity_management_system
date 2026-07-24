import type { DbClient, MutationResult } from '@/dal/types'

// ── Types ──────────────────────────────────────────────────────────────────

export type RoomAssignment = {
  id: string
  room_id: string
  member_id: string
  term_id: string
  starts_on: string
  ends_on: string | null
  notes: string | null
  member_name: string
}

export type RoomWithOccupants = {
  id: string
  name: string
  room_number: string | null
  floor: string | null
  capacity: number | null
  ideal_capacity: number | null
  type: string | null
  is_active: boolean
  occupants: RoomAssignment[]
}

export type FacilityWithRooms = {
  id: string
  name: string
  address: string | null
  rooms: RoomWithOccupants[]
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getOccupancyDal(
  supabase: DbClient,
  organizationId: string,
  termId: string
): Promise<FacilityWithRooms[]> {
  // Errors must surface, not render as "everything is vacant" — the house
  // manager makes write decisions from this board
  const { data: facilities, error: facilitiesError } = await supabase
    .from('facilities')
    .select('id, name, address')
    .eq('organization_id', organizationId)
    .order('name')
  if (facilitiesError) throw new Error(`Failed to load facilities: ${facilitiesError.message}`)

  if (!facilities || facilities.length === 0) return []

  const facilityIds = facilities.map((f) => f.id)

  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, name, room_number, floor, capacity, ideal_capacity, type, is_active, facility_id')
    .in('facility_id', facilityIds)
    .order('display_order', { ascending: true })
  if (roomsError) throw new Error(`Failed to load rooms: ${roomsError.message}`)

  const roomIds = (rooms ?? []).map((r) => r.id)

  // All of the term's assignments, including ended ones — the UI separates
  // current from past. Filtering ends_on IS NULL here erased history for
  // past terms and hid active assignments with a planned end date (summer
  // boarders).
  const { data: assignments, error: assignmentsError } = await supabase
    .from('room_assignments')
    .select(
      'id, room_id, member_id, term_id, starts_on, ends_on, notes, persons!room_assignments_member_id_fkey(full_name)'
    )
    .in('room_id', roomIds)
    .eq('term_id', termId)
  if (assignmentsError) throw new Error(`Failed to load assignments: ${assignmentsError.message}`)

  const assignmentsByRoom = new Map<string, RoomAssignment[]>()
  for (const a of assignments ?? []) {
    const person = a.persons as unknown as { full_name: string } | null
    const assignment: RoomAssignment = {
      id: a.id,
      room_id: a.room_id,
      member_id: a.member_id,
      term_id: a.term_id,
      starts_on: a.starts_on,
      ends_on: a.ends_on,
      notes: a.notes,
      member_name: person?.full_name ?? 'Unknown',
    }
    const list = assignmentsByRoom.get(a.room_id) ?? []
    list.push(assignment)
    assignmentsByRoom.set(a.room_id, list)
  }

  const roomsByFacility = new Map<string, RoomWithOccupants[]>()
  for (const r of rooms ?? []) {
    const room: RoomWithOccupants = {
      id: r.id,
      name: r.name,
      room_number: r.room_number,
      floor: r.floor,
      capacity: r.capacity,
      ideal_capacity: r.ideal_capacity,
      type: r.type,
      is_active: r.is_active ?? true,
      occupants: assignmentsByRoom.get(r.id) ?? [],
    }
    const list = roomsByFacility.get(r.facility_id) ?? []
    list.push(room)
    roomsByFacility.set(r.facility_id, list)
  }

  return facilities.map((f) => ({
    id: f.id,
    name: f.name,
    address: f.address,
    rooms: roomsByFacility.get(f.id) ?? [],
  }))
}

/** Terms for the housing term selector, newest first. */
export async function getHousingTermsDal(
  supabase: DbClient,
  groupId: string
): Promise<Array<{ id: string; name: string; status: string }>> {
  const { data, error } = await supabase
    .from('terms')
    .select('id, name, status, starts_on')
    .eq('group_id', groupId)
    .order('starts_on', { ascending: false, nullsFirst: false })
  if (error) throw new Error(`Failed to load terms: ${error.message}`)
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, status: t.status ?? 'unknown' }))
}

/** Active group members for the assign picker, sorted by name. */
export async function getAssignableMembersDal(
  supabase: DbClient,
  groupId: string
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('group_memberships')
    .select('person_id, persons!group_memberships_person_id_fkey(full_name)')
    .eq('group_id', groupId)
    .is('ended_at', null)
  if (error) throw new Error(`Failed to load members: ${error.message}`)

  const unique = new Map<string, { id: string; name: string }>()
  for (const m of data ?? []) {
    unique.set(m.person_id, {
      id: m.person_id,
      name: (m.persons as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
    })
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Does this person have an active membership in the group? Used to bind
 * assignment targets to the group before writing. */
export async function isActiveGroupMemberDal(
  supabase: DbClient,
  groupId: string,
  personId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('group_memberships')
    .select('id')
    .eq('group_id', groupId)
    .eq('person_id', personId)
    .is('ended_at', null)
    .limit(1)
    .maybeSingle()
  return !!data
}

/** Does this term belong to the group? */
export async function termBelongsToGroupDal(
  supabase: DbClient,
  groupId: string,
  termId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('terms')
    .select('id')
    .eq('id', termId)
    .eq('group_id', groupId)
    .maybeSingle()
  return !!data
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function assignRoomDal(
  supabase: DbClient,
  input: {
    room_id: string
    member_id: string
    term_id: string
    starts_on: string
    notes?: string | null
  }
): Promise<MutationResult<string>> {
  const { data, error } = await supabase
    .from('room_assignments')
    .insert({
      room_id: input.room_id,
      member_id: input.member_id,
      term_id: input.term_id,
      starts_on: input.starts_on,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: data.id }
}

export async function endAssignmentDal(
  supabase: DbClient,
  assignmentId: string,
  endsOn: string
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('room_assignments')
    .update({ ends_on: endsOn })
    .eq('id', assignmentId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function swapResidentsDal(
  supabase: DbClient,
  assignmentIdA: string,
  assignmentIdB: string
): Promise<MutationResult<void>> {
  const { data: rows, error: readErr } = await supabase
    .from('room_assignments')
    .select('id, room_id')
    .in('id', [assignmentIdA, assignmentIdB])

  if (readErr || !rows || rows.length !== 2) {
    return { success: false, error: 'Could not find both assignments' }
  }

  const a = rows.find((r) => r.id === assignmentIdA)
  const b = rows.find((r) => r.id === assignmentIdB)
  if (!a || !b) return { success: false, error: 'Could not find both assignments' }

  if (a.room_id === b.room_id) {
    return { success: false, error: 'Those two residents are already in the same room' }
  }

  const { error: errA } = await supabase
    .from('room_assignments')
    .update({ room_id: b.room_id })
    .eq('id', assignmentIdA)

  if (errA) return { success: false, error: errA.message }

  const { error: errB } = await supabase
    .from('room_assignments')
    .update({ room_id: a.room_id })
    .eq('id', assignmentIdB)

  if (errB) {
    // Roll the first move back so a half-swap never strands both residents
    // in the same room (best-effort — PostgREST has no transactions)
    await supabase.from('room_assignments').update({ room_id: a.room_id }).eq('id', assignmentIdA)
    return { success: false, error: `Swap failed and was rolled back: ${errB.message}` }
  }

  return { success: true }
}

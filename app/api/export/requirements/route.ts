import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildRequirementsCsv } from '@/lib/utils/export-csv'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const groupId = request.nextUrl.searchParams.get('groupId')
  const termId = request.nextUrl.searchParams.get('termId')
  const termName = request.nextUrl.searchParams.get('termName') ?? 'export'

  if (!groupId || !termId) {
    return NextResponse.json({ error: 'Missing groupId or termId' }, { status: 400 })
  }

  const { data: requirements } = await supabase
    .from('requirements')
    .select('id, title, kind, due_at, occurs_at, amount_cents, quota_target, quota_unit')
    .eq('group_id', groupId)
    .eq('term_id', termId)
    .order('created_at')

  if (!requirements || requirements.length === 0) {
    return NextResponse.json({ error: 'No requirements found' }, { status: 404 })
  }

  const reqIds = requirements.map((r) => r.id)
  const { data: assignments } = await supabase
    .from('requirement_assignments')
    .select(
      'requirement_id, status, progress, completed_at, note, persons!requirement_assignments_person_id_fkey(full_name)'
    )
    .in('requirement_id', reqIds)
    .order('created_at')

  if (!assignments) {
    return NextResponse.json({ error: 'No assignments found' }, { status: 404 })
  }

  const reqMap = new Map(requirements.map((r) => [r.id, r]))

  const rows = assignments.map((a) => {
    const req = reqMap.get(a.requirement_id)
    return {
      person_name: (a.persons as { full_name: string })?.full_name ?? 'Unknown',
      requirement_title: req?.title ?? '',
      kind: req?.kind ?? '',
      status: a.status ?? 'pending',
      progress: a.progress ?? 0,
      amount_cents: req?.amount_cents ?? null,
      quota_target: req?.quota_target ?? null,
      quota_unit: req?.quota_unit ?? null,
      due_at: req?.due_at ?? null,
      occurs_at: req?.occurs_at ?? null,
      completed_at: a.completed_at,
      note: a.note,
    }
  })

  rows.sort((a, b) => a.person_name.localeCompare(b.person_name))

  const csv = buildRequirementsCsv(rows)
  const filename = `requirements-${termName.replace(/\s+/g, '-').toLowerCase()}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

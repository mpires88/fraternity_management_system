import { createClient } from '@supabase/supabase-js'
import { buildIcs, type IcsEvent } from '@/lib/utils/ics'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('person_id')
    .eq('calendar_feed_token', token)
    .single()

  if (!pref) {
    return new Response('Not found', { status: 404 })
  }

  const { data: assignments } = await supabase
    .from('requirement_assignments')
    .select('id, status, requirements!inner(title, kind, due_at, occurs_at)')
    .eq('person_id', pref.person_id)
    .in('status', ['pending', 'in_progress', 'submitted'])

  type ReqData = {
    title: string
    kind: string
    due_at: string | null
    occurs_at: string | null
  }

  const events: IcsEvent[] = []
  for (const a of assignments ?? []) {
    const req = a.requirements as unknown as ReqData
    const date = req.kind === 'attendance' ? req.occurs_at : req.due_at
    if (!date) continue

    events.push({
      uid: `${a.id}@chapter-platform`,
      summary: `${req.kind === 'attendance' ? '[Event] ' : '[Due] '}${req.title}`,
      dtstart: date,
      description: `Status: ${a.status}`,
    })
  }

  const ics = buildIcs('Chapter Requirements', events)

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="requirements.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

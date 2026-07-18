import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { NOTIFICATION_TYPES } from '@/lib/constants/notifications'
import { buildGroupHref } from '@/lib/utils/hrefs'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  const { data: dueSoon } = await supabase
    .from('requirement_assignments')
    .select('id, person_id, requirement_id, requirements!inner(title, due_at, group_id)')
    .in('status', ['pending', 'in_progress', 'submitted'])
    .not('requirements.due_at', 'is', null)
    .lte('requirements.due_at', threeDaysOut)

  if (!dueSoon || dueSoon.length === 0) {
    return NextResponse.json({ notified: 0, emailed: 0 })
  }

  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('group_key')
    .eq('type', NOTIFICATION_TYPES.DUE_SOON)
    .in(
      'group_key',
      dueSoon.map((a) => `${NOTIFICATION_TYPES.DUE_SOON}:${a.id}`)
    )

  const alreadyNotified = new Set((existingNotifs ?? []).map((n) => n.group_key))

  type ReqData = { title: string; due_at: string; group_id: string }
  const toNotify = dueSoon.filter(
    (a) => !alreadyNotified.has(`${NOTIFICATION_TYPES.DUE_SOON}:${a.id}`)
  )

  if (toNotify.length > 0) {
    // Resolve each group's slug path once so hrefs are group-prefixed
    const groupIds = [
      ...new Set(toNotify.map((a) => (a.requirements as unknown as ReqData).group_id)),
    ]
    const { data: groupRows } = await supabase
      .from('groups')
      .select('id, slug, organizations(slug, parent_organizations(slug))')
      .in('id', groupIds)

    const hrefByGroup = new Map<string, string>()
    for (const g of groupRows ?? []) {
      const org = g.organizations as unknown as {
        slug: string
        parent_organizations: { slug: string } | null
      } | null
      if (org?.parent_organizations) {
        hrefByGroup.set(
          g.id,
          buildGroupHref(
            { parentSlug: org.parent_organizations.slug, orgSlug: org.slug, groupSlug: g.slug },
            '/requirements'
          )
        )
      }
    }

    const rows = toNotify.map((a) => {
      const req = a.requirements as unknown as ReqData
      const isPast = req.due_at < today
      return {
        person_id: a.person_id,
        group_id: req.group_id,
        type: NOTIFICATION_TYPES.DUE_SOON,
        group_key: `${NOTIFICATION_TYPES.DUE_SOON}:${a.id}`,
        title: isPast
          ? `Overdue: "${req.title}" was due ${req.due_at}`
          : `Due soon: "${req.title}" is due ${req.due_at}`,
        href: hrefByGroup.get(req.group_id) ?? '/',
      }
    })

    await supabase.from('notifications').insert(rows)
  }

  let emailedCount = 0

  const { data: unsentNotifs } = await supabase
    .from('notifications')
    .select('id, person_id, title')
    .eq('type', NOTIFICATION_TYPES.DUE_SOON)
    .is('emailed_at', null)
    .is('read_at', null)

  if (unsentNotifs && unsentNotifs.length > 0) {
    const personIds = [...new Set(unsentNotifs.map((n) => n.person_id))]

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('person_id')
      .in('person_id', personIds)
      .eq('email_enabled', true)

    const optedIn = new Set((prefs ?? []).map((p) => p.person_id))

    if (optedIn.size > 0) {
      const { data: persons } = await supabase
        .from('persons')
        .select('id, email, full_name')
        .in('id', [...optedIn])

      const personMap = new Map((persons ?? []).map((p) => [p.id, p]))

      const byPerson = new Map<string, { titles: string[]; notifIds: string[] }>()
      for (const n of unsentNotifs) {
        if (!optedIn.has(n.person_id)) continue
        if (!byPerson.has(n.person_id)) {
          byPerson.set(n.person_id, { titles: [], notifIds: [] })
        }
        const entry = byPerson.get(n.person_id)!
        entry.titles.push(n.title)
        entry.notifIds.push(n.id)
      }

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY)

        for (const [personId, { titles, notifIds }] of byPerson) {
          const person = personMap.get(personId)
          if (!person?.email) continue

          const listHtml = titles.map((t) => `<li>${t}</li>`).join('')
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.example.com'

          await resend.emails.send({
            from: 'Chapter Platform <notifications@notifications.example.com>',
            to: person.email,
            subject: `${titles.length} requirement${titles.length > 1 ? 's' : ''} due soon`,
            html: `<p>Hi ${person.full_name},</p>
<p>You have upcoming requirements:</p>
<ul>${listHtml}</ul>
<p><a href="${appUrl}">Open the app to view your requirements</a></p>`,
          })

          await supabase
            .from('notifications')
            .update({ emailed_at: new Date().toISOString() })
            .in('id', notifIds)

          emailedCount++
        }
      }
    }
  }

  return NextResponse.json({
    notified: toNotify.length,
    emailed: emailedCount,
  })
}

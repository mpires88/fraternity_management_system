export type IcsEvent = {
  uid: string
  summary: string
  dtstart: string
  dtend?: string
  description?: string
  url?: string
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatDate(iso: string): string {
  return iso
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .slice(0, 8)
}

export function buildIcs(calName: string, events: IcsEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChapterPlatform//Requirements//EN',
    `X-WR-CALNAME:${escapeIcs(calName)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const e of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.uid}`)
    lines.push(`DTSTART;VALUE=DATE:${formatDate(e.dtstart)}`)
    if (e.dtend) {
      lines.push(`DTEND;VALUE=DATE:${formatDate(e.dtend)}`)
    }
    lines.push(`SUMMARY:${escapeIcs(e.summary)}`)
    if (e.description) {
      lines.push(`DESCRIPTION:${escapeIcs(e.description)}`)
    }
    if (e.url) {
      lines.push(`URL:${e.url}`)
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

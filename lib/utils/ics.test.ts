import { describe, expect, it } from 'vitest'
import { buildIcs, type IcsEvent } from './ics'

describe('buildIcs', () => {
  it('produces valid VCALENDAR wrapper', () => {
    const ics = buildIcs('Test Cal', [])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('X-WR-CALNAME:Test Cal')
  })

  it('renders a single all-day event', () => {
    const events: IcsEvent[] = [
      {
        uid: 'test-1@chapter',
        summary: 'Community Service',
        dtstart: '2026-07-15',
      },
    ]
    const ics = buildIcs('Obligations', events)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('UID:test-1@chapter')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260715')
    expect(ics).toContain('SUMMARY:Community Service')
    expect(ics).toContain('END:VEVENT')
  })

  it('escapes special characters in summary and description', () => {
    const events: IcsEvent[] = [
      {
        uid: 'test-2@chapter',
        summary: 'Meeting; with, special\\chars',
        dtstart: '2026-08-01',
        description: 'Line 1\nLine 2',
      },
    ]
    const ics = buildIcs('Cal', events)
    expect(ics).toContain('SUMMARY:Meeting\\; with\\, special\\\\chars')
    expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2')
  })

  it('includes dtend and url when provided', () => {
    const events: IcsEvent[] = [
      {
        uid: 'test-3@chapter',
        summary: 'Dues',
        dtstart: '2026-07-01',
        dtend: '2026-07-02',
        url: 'https://app.example.com/requirements',
      },
    ]
    const ics = buildIcs('Cal', events)
    expect(ics).toContain('DTEND;VALUE=DATE:20260702')
    expect(ics).toContain('URL:https://app.example.com/requirements')
  })

  it('handles multiple events', () => {
    const events: IcsEvent[] = [
      { uid: 'a@chapter', summary: 'First', dtstart: '2026-07-01' },
      { uid: 'b@chapter', summary: 'Second', dtstart: '2026-07-02' },
    ]
    const ics = buildIcs('Cal', events)
    const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length
    expect(veventCount).toBe(2)
  })

  it('uses CRLF line endings', () => {
    const ics = buildIcs('Cal', [])
    expect(ics).toContain('\r\n')
    expect(ics).not.toMatch(/[^\r]\n/)
  })
})

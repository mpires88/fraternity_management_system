type AssignmentExportRow = {
  person_name: string
  requirement_title: string
  kind: string
  status: string
  progress: number
  amount_cents: number | null
  quota_target: number | null
  quota_unit: string | null
  due_at: string | null
  occurs_at: string | null
  completed_at: string | null
  note: string | null
}

function escapeCell(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function buildRequirementsCsv(rows: AssignmentExportRow[]): string {
  const headers = [
    'Member',
    'Requirement',
    'Kind',
    'Status',
    'Progress',
    'Target',
    'Due Date',
    'Event Date',
    'Completed Date',
    'Note',
  ]

  const lines = [headers.map(escapeCell).join(',')]

  for (const r of rows) {
    let progressStr: string
    if (r.kind === 'payment') {
      progressStr = `$${(r.progress / 100).toFixed(2)}`
    } else if (r.kind === 'quota') {
      progressStr = `${r.progress}`
    } else {
      progressStr = r.status === 'complete' || r.status === 'waived' ? 'Yes' : 'No'
    }

    let targetStr: string
    if (r.kind === 'payment' && r.amount_cents) {
      targetStr = `$${(r.amount_cents / 100).toFixed(2)}`
    } else if (r.kind === 'quota' && r.quota_target) {
      targetStr = `${r.quota_target} ${r.quota_unit ?? ''}`
    } else {
      targetStr = ''
    }

    lines.push(
      [
        escapeCell(r.person_name),
        escapeCell(r.requirement_title),
        escapeCell(r.kind),
        escapeCell(r.status),
        escapeCell(progressStr),
        escapeCell(targetStr.trim()),
        escapeCell(formatDate(r.due_at)),
        escapeCell(formatDate(r.occurs_at)),
        escapeCell(formatDate(r.completed_at)),
        escapeCell(r.note ?? ''),
      ].join(',')
    )
  }

  return lines.join('\n')
}

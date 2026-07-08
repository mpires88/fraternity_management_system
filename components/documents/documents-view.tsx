'use client'

import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createDocument } from '@/actions/documents.action'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import type { DocumentRow } from '@/dal/documents'

type Props = {
  documents: DocumentRow[]
  isAdmin: boolean
}

const KIND_LABELS: Record<string, string> = {
  minutes: 'Minutes',
  bylaws: 'Bylaws',
  budget: 'Budget',
  other: 'Other',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-muted text-muted-foreground',
}

export function DocumentsView({ documents, isAdmin }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Minutes, bylaws, budgets, and more"
        info="Store and manage chapter documents. Draft documents can be edited, submitted for review, and approved. Members can comment and discuss inline."
      >
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus size={14} className="mr-1.5" />
            New Document
          </Button>
        )}
      </PageHeader>

      {documents.length === 0 && (
        <p className="text-muted-foreground py-8 text-center">No documents yet.</p>
      )}

      <div className="space-y-3">
        {documents.map((doc) => (
          <Link key={doc.id} href={`${pathname}/${doc.id}`} className="block">
            <div className="border border-border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <FileText size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-base font-semibold text-foreground truncate">
                        {doc.title}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[doc.status] ?? ''}`}
                      >
                        {doc.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABELS[doc.kind] ?? doc.kind}
                      {doc.version > 1 && ` · v${doc.version}`}
                      {doc.file_name && ` · ${doc.file_name}`}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {showCreate && (
        <CreateDocumentDialog
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            router.push(`${pathname}/${id}`)
          }}
        />
      )}
    </div>
  )
}

function CreateDocumentDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('minutes')
  const [body, setBody] = useState('')

  function handleSubmit() {
    if (!title.trim()) return

    startTransition(async () => {
      const result = await createDocument({
        title: title.trim(),
        kind,
        body: body.trim() || undefined,
      })
      if (result.success && result.data) {
        onCreated(result.data)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-popover border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">New Document</h2>

        <div>
          <label className="text-sm font-medium text-foreground">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
            placeholder="e.g. Chapter Meeting Minutes — July 7"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
          >
            <option value="minutes">Minutes</option>
            <option value="bylaws">Bylaws</option>
            <option value="budget">Budget</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
            rows={6}
            placeholder="Document content..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={isPending || !title.trim()} onClick={handleSubmit}>
            Create
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { ArrowLeft, Check, MessageSquare, Send, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  addComment,
  approveDocument,
  archiveDocument,
  editComment,
  removeComment,
  resolveComment,
  submitForReview,
  unresolveComment,
  updateDocument,
} from '@/actions/documents.action'
import { Button } from '@/components/ui/button'
import type { CommentWithAuthor, DocumentRow } from '@/dal/documents'

type Props = {
  document: DocumentRow
  comments: CommentWithAuthor[]
  isAdmin: boolean
  personId: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  archived: 'Archived',
}

export function DocumentDetail({ document: doc, comments, isAdmin, personId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(doc.body ?? '')
  const [editTitle, setEditTitle] = useState(doc.title)

  function handleSave() {
    startTransition(async () => {
      await updateDocument({
        documentId: doc.id,
        title: editTitle.trim(),
        body: editBody.trim(),
      })
      setEditing(false)
      router.refresh()
    })
  }

  function handleSubmitReview() {
    startTransition(async () => {
      await submitForReview({ documentId: doc.id })
      router.refresh()
    })
  }

  function handleApprove() {
    startTransition(async () => {
      await approveDocument({ documentId: doc.id })
      router.refresh()
    })
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveDocument({ documentId: doc.id })
      router.refresh()
    })
  }

  const parentPath = pathname.replace(/\/[^/]+$/, '')

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={parentPath}>
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft size={14} />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-2xl font-bold bg-input border border-border rounded px-2 py-1 w-full"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{doc.title}</h1>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            {STATUS_LABELS[doc.status] ?? doc.status}
            {doc.approved_at && ` · Approved ${new Date(doc.approved_at).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {isAdmin && doc.status === 'draft' && !editing && (
          <>
            <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="xs" disabled={isPending} onClick={handleSubmitReview}>
              Submit for Review
            </Button>
          </>
        )}
        {isAdmin && doc.status === 'draft' && editing && (
          <>
            <Button size="xs" disabled={isPending} onClick={handleSave}>
              Save
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditing(false)
                setEditBody(doc.body ?? '')
                setEditTitle(doc.title)
              }}
            >
              Cancel
            </Button>
          </>
        )}
        {isAdmin && doc.status === 'in_review' && (
          <>
            <Button size="xs" disabled={isPending} onClick={handleApprove}>
              <Check size={12} className="mr-1" />
              Approve
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditing(true)
              }}
            >
              Edit & Return to Draft
            </Button>
          </>
        )}
        {isAdmin && doc.status === 'approved' && (
          <Button size="xs" variant="outline" disabled={isPending} onClick={handleArchive}>
            Archive
          </Button>
        )}
      </div>

      {/* Document body */}
      <div className="border border-border rounded-lg p-6 bg-card">
        {editing ? (
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            className="w-full min-h-[300px] bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground font-mono"
          />
        ) : doc.body ? (
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {doc.body}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm italic">No content yet.</p>
        )}
      </div>

      {doc.file_name && (
        <div className="text-sm text-muted-foreground">Attached: {doc.file_name}</div>
      )}

      {/* Comments section */}
      <CommentsSection
        resourceType="document"
        resourceId={doc.id}
        comments={comments}
        personId={personId}
        isAdmin={isAdmin}
      />
    </div>
  )
}

function CommentsSection({
  resourceType,
  resourceId,
  comments,
  personId,
  isAdmin,
}: {
  resourceType: string
  resourceId: string
  comments: CommentWithAuthor[]
  personId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const rootComments = comments.filter((c) => !c.parent_comment_id)
  const replies = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId)

  function handlePost(parentId?: string) {
    const body = parentId ? editBody : newComment
    if (!body.trim()) return

    startTransition(async () => {
      await addComment({
        resourceType,
        resourceId,
        body: body.trim(),
        parentCommentId: parentId,
      })
      if (parentId) {
        setReplyTo(null)
        setEditBody('')
      } else {
        setNewComment('')
      }
      router.refresh()
    })
  }

  function handleResolve(commentId: string, isResolved: boolean) {
    startTransition(async () => {
      if (isResolved) {
        await unresolveComment({ commentId })
      } else {
        await resolveComment({ commentId })
      }
      router.refresh()
    })
  }

  function handleEdit(commentId: string) {
    startTransition(async () => {
      await editComment({ commentId, body: editBody.trim() })
      setEditingId(null)
      setEditBody('')
      router.refresh()
    })
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      await removeComment({ commentId })
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <MessageSquare size={18} />
        Comments ({comments.length})
      </h2>

      {rootComments.map((comment) => (
        <CommentThread
          key={comment.id}
          comment={comment}
          replies={replies(comment.id)}
          personId={personId}
          isAdmin={isAdmin}
          isPending={isPending}
          replyTo={replyTo}
          editingId={editingId}
          editBody={editBody}
          onReply={(id) => {
            setReplyTo(id)
            setEditBody('')
          }}
          onCancelReply={() => setReplyTo(null)}
          onPostReply={(parentId) => handlePost(parentId)}
          onResolve={handleResolve}
          onStartEdit={(id, body) => {
            setEditingId(id)
            setEditBody(body)
          }}
          onCancelEdit={() => setEditingId(null)}
          onSaveEdit={handleEdit}
          onDelete={handleDelete}
          onEditBodyChange={setEditBody}
        />
      ))}

      {/* New root comment */}
      <div className="flex gap-2 items-start">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="flex-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground resize-none"
        />
        <Button size="sm" disabled={isPending || !newComment.trim()} onClick={() => handlePost()}>
          <Send size={14} />
        </Button>
      </div>
    </div>
  )
}

function CommentThread({
  comment,
  replies,
  personId,
  isAdmin,
  isPending,
  replyTo,
  editingId,
  editBody,
  onReply,
  onCancelReply,
  onPostReply,
  onResolve,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditBodyChange,
}: {
  comment: CommentWithAuthor
  replies: CommentWithAuthor[]
  personId: string
  isAdmin: boolean
  isPending: boolean
  replyTo: string | null
  editingId: string | null
  editBody: string
  onReply: (id: string) => void
  onCancelReply: () => void
  onPostReply: (parentId: string) => void
  onResolve: (id: string, isResolved: boolean) => void
  onStartEdit: (id: string, body: string) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onDelete: (id: string) => void
  onEditBodyChange: (body: string) => void
}) {
  const isAuthor = comment.created_by === personId
  const isResolved = !!comment.resolved_at

  return (
    <div
      className={`border rounded-lg p-4 space-y-3 ${isResolved ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' : 'border-border bg-card'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">{comment.author_name}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(comment.created_at).toLocaleString()}
            </span>
            {isResolved && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 font-medium">
                resolved
              </span>
            )}
          </div>
          {editingId === comment.id ? (
            <div className="space-y-2">
              <textarea
                value={editBody}
                onChange={(e) => onEditBodyChange(e.target.value)}
                className="w-full px-2 py-1 bg-input border border-border rounded text-sm"
                rows={2}
              />
              <div className="flex gap-1">
                <Button size="xs" disabled={isPending} onClick={() => onSaveEdit(comment.id)}>
                  Save
                </Button>
                <Button size="xs" variant="outline" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap">{comment.body}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onReply(comment.id)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reply
        </button>
        {(isAdmin || isAuthor) && (
          <button
            onClick={() => onResolve(comment.id, isResolved)}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {isResolved ? 'Unresolve' : 'Resolve'}
          </button>
        )}
        {isAuthor && editingId !== comment.id && (
          <button
            onClick={() => onStartEdit(comment.id, comment.body)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Edit
          </button>
        )}
        {isAuthor && (
          <button
            onClick={() => onDelete(comment.id)}
            disabled={isPending}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        )}
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-4 border-l-2 border-border pl-4 space-y-3">
          {replies.map((reply) => (
            <div key={reply.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{reply.author_name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(reply.created_at).toLocaleString()}
                </span>
              </div>
              {editingId === reply.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editBody}
                    onChange={(e) => onEditBodyChange(e.target.value)}
                    className="w-full px-2 py-1 bg-input border border-border rounded text-sm"
                    rows={2}
                  />
                  <div className="flex gap-1">
                    <Button size="xs" disabled={isPending} onClick={() => onSaveEdit(reply.id)}>
                      Save
                    </Button>
                    <Button size="xs" variant="outline" onClick={onCancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">{reply.body}</p>
              )}
              {reply.created_by === personId && editingId !== reply.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onStartEdit(reply.id, reply.body)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(reply.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {replyTo === comment.id && (
        <div className="ml-4 flex gap-2 items-start">
          <textarea
            value={editBody}
            onChange={(e) => onEditBodyChange(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
            className="flex-1 px-2 py-1 bg-input border border-border rounded text-sm resize-none"
          />
          <div className="flex flex-col gap-1">
            <Button
              size="xs"
              disabled={isPending || !editBody.trim()}
              onClick={() => onPostReply(comment.id)}
            >
              <Send size={12} />
            </Button>
            <Button size="xs" variant="outline" onClick={onCancelReply}>
              <X size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

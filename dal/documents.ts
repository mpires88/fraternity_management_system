import type { DbClient } from '@/dal/types'
import type { Json } from '@/lib/supabase/types'

export type DocumentRow = {
  id: string
  group_id: string
  term_id: string | null
  title: string
  kind: string
  body: string | null
  status: string
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  version: number
  parent_document_id: string | null
  file_path: string | null
  file_name: string | null
  file_type: string | null
  poll_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type CreateDocumentInput = {
  title: string
  kind: string
  body?: string
  term_id?: string
  file_path?: string
  file_name?: string
  file_type?: string
}

export async function getDocumentsForGroup(
  supabase: DbClient,
  groupId: string,
  termId?: string
): Promise<DocumentRow[]> {
  let query = supabase
    .from('documents')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (termId) {
    query = query.eq('term_id', termId)
  }

  const { data } = await query
  return (data ?? []) as DocumentRow[]
}

export async function getDocumentById(
  supabase: DbClient,
  documentId: string
): Promise<DocumentRow | null> {
  const { data } = await supabase.from('documents').select('*').eq('id', documentId).single()
  return (data as DocumentRow) ?? null
}

export async function createDocumentDal(
  supabase: DbClient,
  groupId: string,
  createdBy: string,
  input: CreateDocumentInput
): Promise<string> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      group_id: groupId,
      created_by: createdBy,
      title: input.title,
      kind: input.kind,
      body: input.body,
      term_id: input.term_id,
      file_path: input.file_path,
      file_name: input.file_name,
      file_type: input.file_type,
    })
    .select('id')
    .single()

  if (error || !data) throw error
  return data.id
}

export async function updateDocumentDal(
  supabase: DbClient,
  documentId: string,
  updates: { title?: string; body?: string; kind?: string }
) {
  await supabase.from('documents').update(updates).eq('id', documentId)
}

export async function submitForReviewDal(supabase: DbClient, documentId: string) {
  await supabase
    .from('documents')
    .update({ status: 'in_review', submitted_at: new Date().toISOString() })
    .eq('id', documentId)
}

export async function approveDocumentDal(
  supabase: DbClient,
  documentId: string,
  approvedBy: string
) {
  await supabase
    .from('documents')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq('id', documentId)
}

export async function archiveDocumentDal(supabase: DbClient, documentId: string) {
  await supabase.from('documents').update({ status: 'archived' }).eq('id', documentId)
}

export async function linkPollToDocumentDal(
  supabase: DbClient,
  documentId: string,
  pollId: string
) {
  await supabase.from('documents').update({ poll_id: pollId }).eq('id', documentId)
  await supabase.from('polls').update({ document_id: documentId }).eq('id', pollId)
}

export async function deleteDocumentDal(supabase: DbClient, documentId: string) {
  await supabase.from('documents').delete().eq('id', documentId)
}

// -- Comments DAL --

export type CommentRow = {
  id: string
  group_id: string
  resource_type: string
  resource_id: string
  parent_comment_id: string | null
  body: string
  visibility: string
  resolved_at: string | null
  resolved_by: string | null
  anchor_text: string | null
  anchor_context_before: string | null
  anchor_context_after: string | null
  anchor_metadata: Record<string, unknown> | null
  created_by: string
  created_at: string
  updated_at: string
}

export type CommentWithAuthor = CommentRow & {
  author_name: string
}

export async function getCommentsForResource(
  supabase: DbClient,
  resourceType: string,
  resourceId: string
): Promise<CommentWithAuthor[]> {
  const { data } = await supabase
    .from('comments')
    .select('*, persons!comments_created_by_fkey(full_name)')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((c) => {
    const person = c.persons as unknown as { full_name: string } | null
    return {
      ...(c as unknown as CommentRow),
      author_name: person?.full_name ?? 'Unknown',
    }
  })
}

export async function createCommentDal(
  supabase: DbClient,
  groupId: string,
  createdBy: string,
  input: {
    resource_type: string
    resource_id: string
    body: string
    parent_comment_id?: string
    anchor_text?: string
    anchor_context_before?: string
    anchor_context_after?: string
    anchor_metadata?: Record<string, unknown>
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      group_id: groupId,
      created_by: createdBy,
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      body: input.body,
      parent_comment_id: input.parent_comment_id,
      anchor_text: input.anchor_text,
      anchor_context_before: input.anchor_context_before,
      anchor_context_after: input.anchor_context_after,
      anchor_metadata: (input.anchor_metadata as Json) ?? null,
    })
    .select('id')
    .single()

  if (error || !data) throw error
  return data.id
}

export async function resolveCommentDal(supabase: DbClient, commentId: string, resolvedBy: string) {
  await supabase
    .from('comments')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq('id', commentId)
}

export async function unresolveCommentDal(supabase: DbClient, commentId: string) {
  await supabase
    .from('comments')
    .update({
      resolved_at: null,
      resolved_by: null,
    })
    .eq('id', commentId)
}

export async function deleteCommentDal(supabase: DbClient, commentId: string) {
  await supabase.from('comments').delete().eq('id', commentId)
}

export async function updateCommentDal(supabase: DbClient, commentId: string, body: string) {
  await supabase.from('comments').update({ body }).eq('id', commentId)
}

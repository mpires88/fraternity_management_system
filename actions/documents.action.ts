'use server'

import {
  createAuthenticatedAction,
  createOrgAuthenticatedAction,
  createOrgQueryAction,
} from '@/actions/utils/action-helpers'
import type { CommentWithAuthor, CreateDocumentInput, DocumentRow } from '@/dal/documents'
import {
  approveDocumentDal,
  archiveDocumentDal,
  createCommentDal,
  createDocumentDal,
  deleteCommentDal,
  deleteDocumentDal,
  getCommentsForResource,
  getDocumentById,
  getDocumentsForGroup,
  linkPollToDocumentDal,
  resolveCommentDal,
  submitForReviewDal,
  unresolveCommentDal,
  updateCommentDal,
  updateDocumentDal,
} from '@/dal/documents'

// -- Document actions --

export const getDocuments = createOrgQueryAction<{ termId?: string }, DocumentRow[]>(
  async (supabase, _actor, groupId, input) => {
    return getDocumentsForGroup(supabase, groupId, input.termId)
  }
)

export const getDocument = createAuthenticatedAction<{ documentId: string }, DocumentRow>(
  async (supabase, _actor, input) => {
    const doc = await getDocumentById(supabase, input.documentId)
    if (!doc) throw new Error('Document not found')
    return doc
  }
)

export const createDocument = createOrgAuthenticatedAction<CreateDocumentInput, string>(
  async (supabase, actor, groupId, input) => {
    return createDocumentDal(supabase, groupId, actor.personId, input)
  }
)

export const updateDocument = createOrgAuthenticatedAction<
  { documentId: string; title?: string; body?: string; kind?: string },
  void
>(async (supabase, _actor, _groupId, input) => {
  const { documentId, ...updates } = input
  await updateDocumentDal(supabase, documentId, updates)
})

export const submitForReview = createOrgAuthenticatedAction<{ documentId: string }, void>(
  async (supabase, _actor, _groupId, input) => {
    await submitForReviewDal(supabase, input.documentId)
  }
)

export const approveDocument = createOrgAuthenticatedAction<{ documentId: string }, void>(
  async (supabase, actor, _groupId, input) => {
    await approveDocumentDal(supabase, input.documentId, actor.personId)
  }
)

export const archiveDocument = createOrgAuthenticatedAction<{ documentId: string }, void>(
  async (supabase, _actor, _groupId, input) => {
    await archiveDocumentDal(supabase, input.documentId)
  }
)

export const deleteDocument = createOrgAuthenticatedAction<{ documentId: string }, void>(
  async (supabase, _actor, _groupId, input) => {
    await deleteDocumentDal(supabase, input.documentId)
  }
)

export const linkPollToDocument = createOrgAuthenticatedAction<
  { documentId: string; pollId: string },
  void
>(async (supabase, _actor, _groupId, input) => {
  await linkPollToDocumentDal(supabase, input.documentId, input.pollId)
})

// -- Comment actions --

export const getComments = createAuthenticatedAction<
  { resourceType: string; resourceId: string },
  CommentWithAuthor[]
>(async (supabase, _actor, input) => {
  return getCommentsForResource(supabase, input.resourceType, input.resourceId)
})

export const addComment = createOrgAuthenticatedAction<
  {
    resourceType: string
    resourceId: string
    body: string
    parentCommentId?: string
  },
  string
>(async (supabase, actor, groupId, input) => {
  return createCommentDal(supabase, groupId, actor.personId, {
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    body: input.body,
    parent_comment_id: input.parentCommentId,
  })
})

export const resolveComment = createAuthenticatedAction<{ commentId: string }, void>(
  async (supabase, actor, input) => {
    await resolveCommentDal(supabase, input.commentId, actor.personId)
  }
)

export const unresolveComment = createAuthenticatedAction<{ commentId: string }, void>(
  async (supabase, _actor, input) => {
    await unresolveCommentDal(supabase, input.commentId)
  }
)

export const editComment = createAuthenticatedAction<{ commentId: string; body: string }, void>(
  async (supabase, _actor, input) => {
    await updateCommentDal(supabase, input.commentId, input.body)
  }
)

export const removeComment = createAuthenticatedAction<{ commentId: string }, void>(
  async (supabase, _actor, input) => {
    await deleteCommentDal(supabase, input.commentId)
  }
)

import { createError } from '../../common/http-error'
import * as z from 'zod/v4'
import prisma from '../../prisma/prisma.client'
import { canView } from './trips'

// Comments on community trips: plain text, tip or question. Shown under the commenter's
// public traveler profile (never their account name or email). Counts change in the same
// transaction as the comment.

export const MAX_COMMENT_LENGTH = 2000
/** Per user, rolling hour (stored rows, so it holds across serverless instances) */
export const COMMENTS_PER_HOUR = 20
const PAGE = 20

export const CommentInputSchema = z.object({
  body: z.string().max(MAX_COMMENT_LENGTH * 2),
  kind: z.enum(['TIP', 'QUESTION']).default('TIP')
})

export interface CommentView {
  id: string
  body: string
  kind: 'TIP' | 'QUESTION'
  createdAt: string
  editedAt: string | null
  /** Null when the account was deleted or the profile suspended */
  author: { handle: string; displayName: string; avatarUrl: string | null } | null
  mine: boolean
}

/** Trims, keeps at most one blank line between paragraphs, and enforces the length. */
export function cleanCommentBody(raw: string) {
  const body = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!body) throw createError({ statusCode: 400, message: 'Write a comment first.' })
  if ([...body].length > MAX_COMMENT_LENGTH) throw createError({ statusCode: 400, message: `Comments can be up to ${MAX_COMMENT_LENGTH} characters.` })
  return body
}

/** Comments are open on trips anyone with the link can see (public or unlisted). */
async function commentableTrip(slug: string) {
  const trip = await prisma.publishedTrip.findUnique({
    where: { slug },
    select: { id: true, authorId: true, visibility: true, status: true, author: { select: { status: true } } }
  })
  if (!trip || !canView(trip, null)) throw createError({ statusCode: 404, message: 'This trip was not found.' })
  return trip
}

export async function listComments(slug: string, viewerId: string | null, cursor?: string) {
  const trip = await commentableTrip(slug)
  const before = cursor && !Number.isNaN(Date.parse(cursor)) ? new Date(cursor) : undefined
  const rows = await prisma.tripComment.findMany({
    where: { tripId: trip.id, status: 'ACTIVE', ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE + 1,
    select: {
      id: true,
      body: true,
      kind: true,
      createdAt: true,
      editedAt: true,
      authorId: true,
      author: { select: { travelerProfile: { select: { handle: true, displayName: true, avatarUrl: true, status: true } } } }
    }
  })
  const page = rows.slice(0, PAGE)
  const data: CommentView[] = page.map((row) => {
    const profile = row.author?.travelerProfile
    return {
      id: row.id,
      body: row.body,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      author: profile && profile.status === 'ACTIVE' ? { handle: profile.handle, displayName: profile.displayName, avatarUrl: profile.avatarUrl } : null,
      mine: !!viewerId && row.authorId === viewerId
    }
  })
  return { data, nextCursor: rows.length > PAGE ? page[page.length - 1].createdAt.toISOString() : null }
}

export async function addComment(viewerId: string, slug: string, input: z.infer<typeof CommentInputSchema>) {
  const body = cleanCommentBody(input.body)
  const profile = await prisma.travelerProfile.findUnique({ where: { userId: viewerId }, select: { status: true } })
  if (!profile) throw createError({ statusCode: 409, message: 'Create your traveler profile first.' })
  if (profile.status !== 'ACTIVE') throw createError({ statusCode: 403, message: 'This profile has been suspended.' })

  const trip = await commentableTrip(slug)
  const recent = await prisma.tripComment.count({ where: { authorId: viewerId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } })
  if (recent >= COMMENTS_PER_HOUR) throw createError({ statusCode: 429, message: 'You have posted a lot of comments. Please try again later.' })

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.tripComment.create({ data: { tripId: trip.id, authorId: viewerId, body, kind: input.kind }, select: { id: true } })
    await tx.publishedTrip.update({ where: { id: trip.id }, data: { commentCount: { increment: 1 } } })
    return created
  })
  return comment
}

/** Authors can edit their own visible comments. */
export async function editComment(viewerId: string, id: string, rawBody: string) {
  const body = cleanCommentBody(rawBody)
  const result = await prisma.tripComment.updateMany({ where: { id, authorId: viewerId, status: 'ACTIVE' }, data: { body, editedAt: new Date() } })
  if (result.count === 0) throw createError({ statusCode: 404, message: 'This comment was not found.' })
}

/** Authors delete their own comments; admins can delete any. The row is removed. */
export async function deleteComment(viewer: { id: string; role: string }, id: string) {
  const comment = await prisma.tripComment.findUnique({ where: { id }, select: { id: true, tripId: true, authorId: true, status: true } })
  if (!comment || (comment.authorId !== viewer.id && viewer.role !== 'ADMIN')) {
    throw createError({ statusCode: 404, message: 'This comment was not found.' })
  }
  await prisma.$transaction(async (tx) => {
    const removed = await tx.tripComment.deleteMany({ where: { id: comment.id } })
    // Hidden comments were already taken out of the count when they were hidden
    if (removed.count && comment.status === 'ACTIVE') {
      await tx.publishedTrip.updateMany({ where: { id: comment.tripId, commentCount: { gt: 0 } }, data: { commentCount: { decrement: 1 } } })
    }
  })
}

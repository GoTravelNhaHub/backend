import { createError } from '../../common/http-error'
import * as z from 'zod/v4'
import prisma from '../../prisma/prisma.client'

// Reports from users and the admin moderation queue. Hiding is reversible (status HIDDEN):
// hidden trips, comments and profiles return 404 to everyone but moderators, and leave the
// sitemap and counts. Nothing here deletes content.

export const REPORT_REASONS = ['spam', 'unsafe', 'personal_info', 'offensive', 'other'] as const
/** Per user, rolling hour */
export const REPORTS_PER_HOUR = 10

export const ReportInputSchema = z.object({
  targetType: z.enum(['TRIP', 'COMMENT', 'PROFILE']),
  // Trip slug, comment id, or profile handle: what the page has
  target: z.string().trim().min(1).max(80),
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(500).optional()
})
type ReportInput = z.infer<typeof ReportInputSchema>

/** The stored id of what was reported. Only things the reporter could see can be reported. */
async function resolveTarget(type: ReportInput['targetType'], target: string) {
  if (type === 'TRIP') {
    const trip = await prisma.publishedTrip.findFirst({ where: { slug: target, status: 'ACTIVE', visibility: { not: 'PRIVATE' } }, select: { id: true } })
    return trip?.id ?? null
  }
  if (type === 'COMMENT') {
    const comment = await prisma.tripComment.findFirst({ where: { id: target, status: 'ACTIVE' }, select: { id: true } })
    return comment?.id ?? null
  }
  const profile = await prisma.travelerProfile.findFirst({ where: { handle: target, status: 'ACTIVE' }, select: { userId: true } })
  return profile?.userId ?? null
}

/** One report per user and target: reporting again updates the reason and reopens it. */
export async function reportContent(reporterId: string, input: ReportInput) {
  const targetId = await resolveTarget(input.targetType, input.target)
  if (!targetId) throw createError({ statusCode: 404, message: 'This content was not found.' })
  const recent = await prisma.contentReport.count({ where: { reporterId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } })
  if (recent >= REPORTS_PER_HOUR) throw createError({ statusCode: 429, message: 'You have sent a lot of reports. Please try again later.' })

  await prisma.contentReport.upsert({
    where: { reporterId_targetType_targetId: { reporterId, targetType: input.targetType, targetId } },
    create: { reporterId, targetType: input.targetType, targetId, reason: input.reason, note: input.note || null },
    update: { reason: input.reason, note: input.note || null, status: 'OPEN', resolvedBy: null, resolvedAt: null }
  })
}

// ---------------------------------------------------------------------------
// Admin queue (routes under /api/admin, guarded by server/middleware/auth-guard.ts)

export interface ReportTargetView {
  type: 'TRIP' | 'COMMENT' | 'PROFILE'
  id: string
  status: 'ACTIVE' | 'HIDDEN' | 'REMOVED' | 'MISSING'
  title: string
  /** Where a moderator can see it */
  link: string | null
}

async function describeTarget(type: ReportTargetView['type'], id: string): Promise<ReportTargetView> {
  if (type === 'TRIP') {
    const trip = await prisma.publishedTrip.findUnique({ where: { id }, select: { title: true, slug: true, status: true } })
    return trip ? { type, id, status: trip.status, title: trip.title, link: `/community/trips/${trip.slug}` } : { type, id, status: 'MISSING', title: '', link: null }
  }
  if (type === 'COMMENT') {
    const comment = await prisma.tripComment.findUnique({ where: { id }, select: { body: true, status: true, trip: { select: { slug: true } } } })
    return comment
      ? { type, id, status: comment.status, title: comment.body.slice(0, 280), link: `/community/trips/${comment.trip.slug}#comments` }
      : { type, id, status: 'MISSING', title: '', link: null }
  }
  const profile = await prisma.travelerProfile.findUnique({ where: { userId: id }, select: { handle: true, displayName: true, status: true } })
  return profile
    ? { type, id, status: profile.status, title: `${profile.displayName} (@${profile.handle})`, link: `/travelers/${profile.handle}` }
    : { type, id, status: 'MISSING', title: '', link: null }
}

/** Reported targets, grouped: one row per target with its reasons and report count. */
export async function listReportQueue(status: 'OPEN' | 'ACTIONED' | 'DISMISSED' = 'OPEN') {
  const reports = await prisma.contentReport.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, targetType: true, targetId: true, reason: true, note: true, createdAt: true }
  })
  const groups = new Map<string, { type: ReportTargetView['type']; id: string; reports: typeof reports }>()
  for (const report of reports) {
    const key = `${report.targetType}:${report.targetId}`
    const group = groups.get(key) ?? { type: report.targetType, id: report.targetId, reports: [] }
    group.reports.push(report)
    groups.set(key, group)
  }
  return Promise.all(
    [...groups.values()].map(async (group) => ({
      target: await describeTarget(group.type, group.id),
      count: group.reports.length,
      reasons: [...new Set(group.reports.map((report) => report.reason))],
      notes: group.reports.map((report) => report.note).filter((note): note is string => !!note).slice(0, 5),
      latestAt: group.reports[0].createdAt.toISOString()
    }))
  )
}

/** Sets a target's status. Hiding or restoring a comment keeps the trip's comment count right. */
async function setTargetStatus(type: ReportTargetView['type'], id: string, status: 'ACTIVE' | 'HIDDEN') {
  if (type === 'TRIP') {
    const result = await prisma.publishedTrip.updateMany({ where: { id, status: { not: 'REMOVED' } }, data: { status } })
    if (!result.count) throw createError({ statusCode: 404, message: 'Trip not found.' })
    return
  }
  if (type === 'PROFILE') {
    const result = await prisma.travelerProfile.updateMany({ where: { userId: id, status: { not: 'REMOVED' } }, data: { status } })
    if (!result.count) throw createError({ statusCode: 404, message: 'Profile not found.' })
    return
  }
  await prisma.$transaction(async (tx) => {
    const comment = await tx.tripComment.findUnique({ where: { id }, select: { status: true, tripId: true } })
    if (!comment || comment.status === 'REMOVED') throw createError({ statusCode: 404, message: 'Comment not found.' })
    if (comment.status === status) return
    await tx.tripComment.update({ where: { id }, data: { status } })
    await tx.publishedTrip.updateMany({
      where: { id: comment.tripId, ...(status === 'HIDDEN' ? { commentCount: { gt: 0 } } : {}) },
      data: { commentCount: status === 'HIDDEN' ? { decrement: 1 } : { increment: 1 } }
    })
  })
}

export const ModerationActionSchema = z.object({
  targetType: z.enum(['TRIP', 'COMMENT', 'PROFILE']),
  targetId: z.string().min(1).max(80),
  action: z.enum(['hide', 'restore', 'dismiss'])
})

/**
 * hide: hide the target and mark its open reports actioned.
 * restore: make a hidden target visible again (reports stay as they were).
 * dismiss: close its open reports without changing the target.
 */
export async function moderate(adminId: string, input: z.infer<typeof ModerationActionSchema>) {
  const { targetType, targetId, action } = input
  if (action === 'hide') await setTargetStatus(targetType, targetId, 'HIDDEN')
  if (action === 'restore') await setTargetStatus(targetType, targetId, 'ACTIVE')
  if (action !== 'restore') {
    await prisma.contentReport.updateMany({
      where: { targetType, targetId, status: 'OPEN' },
      data: { status: action === 'hide' ? 'ACTIONED' : 'DISMISSED', resolvedBy: adminId, resolvedAt: new Date() }
    })
  }
  return describeTarget(targetType, targetId)
}

import { createError } from '../../common/http-error'
import { Prisma } from '@prisma/client'
import * as z from 'zod/v4'
import prisma from '../../prisma/prisma.client'
import { handleProblem, normaliseHandle, suggestHandle } from '../../shared/utils/community-handle'

// The signed-in user's public profile. Created the first time they publish; handle and
// display name are chosen by the user, never copied from their email or login username.

export const ProfileInputSchema = z.object({
  handle: z.string().trim().min(1).max(31),
  displayName: z.string().trim().min(1).max(50),
  bio: z.string().trim().max(280).nullable().optional()
})
export type ProfileInput = z.infer<typeof ProfileInputSchema>

export const OWN_PROFILE_SELECT = {
  handle: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  status: true
} as const

export const getOwnProfile = (userId: string) =>
  prisma.travelerProfile.findUnique({ where: { userId }, select: OWN_PROFILE_SELECT })

/** A free handle to offer a new profile. */
export async function suggestFreeHandle(firstName: string | null | undefined) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const handle = suggestHandle(attempt < 3 ? firstName : null)
    const taken = await prisma.travelerProfile.findUnique({ where: { handle }, select: { userId: true } })
    if (!taken) return handle
  }
  return suggestHandle(null)
}

export async function saveOwnProfile(userId: string, input: ProfileInput) {
  const handle = normaliseHandle(input.handle)
  const problem = handleProblem(handle)
  if (problem) {
    throw createError({
      statusCode: 400,
      message: problem === 'reserved' ? 'That handle is reserved. Choose another.' : 'Handles use 3-30 lowercase letters, numbers or _.'
    })
  }

  const existing = await prisma.travelerProfile.findUnique({ where: { userId }, select: { status: true } })
  if (existing && existing.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, message: 'This profile has been suspended.' })
  }

  const data = { handle, displayName: input.displayName, bio: input.bio || null }
  try {
    return await prisma.travelerProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: OWN_PROFILE_SELECT
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, message: 'That handle is taken. Choose another.' })
    }
    throw error
  }
}

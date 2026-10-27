import { type HttpEvent } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'

/** Create a pending referral code for the signed-in user. */
export async function create(event: HttpEvent) {
  try {
    const user = await requireUser(event.req)

    const existingReferral = await prisma.referral.findFirst({
      where: { referrerId: user.id, status: 'PENDING', refereeId: null }
    })

    if (existingReferral) {
      return { success: true, code: existingReferral.referralCode }
    }

    const userIdPrefix = user.id.substring(0, 8).replace(/-/g, '')
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const referralCode = `GVH${userIdPrefix}${randomSuffix}`.toUpperCase()

    await prisma.referral.create({
      data: {
        referrerId: user.id,
        referralCode,
        status: 'PENDING'
      }
    })

    return { success: true, code: referralCode }
  } catch (error: any) {
    console.error('Error creating referral:', error)
    if (error?.statusCode && error.statusCode < 500) throw error
    return { success: false, error: 'Failed to create referral' }
  }
}

import { type HttpEvent } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'

/** The signed-in user's own referral code. */
export async function myCode(event: HttpEvent) {
  try {
    const user = await requireUser(event.req)

    let referral = await prisma.referral.findFirst({
      where: { referrerId: user.id, status: 'PENDING', refereeId: null },
      orderBy: { createdAt: 'desc' }
    })

    if (!referral) {
      const userIdPrefix = user.id.substring(0, 8).replace(/-/g, '')
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
      const referralCode = `GVH${userIdPrefix}${randomSuffix}`.toUpperCase()

      referral = await prisma.referral.create({
        data: {
          referrerId: user.id,
          referralCode,
          status: 'PENDING'
        }
      })
    }

    return {
      success: true,
      code: referral.referralCode
    }
  } catch (error: any) {
    console.error('Error fetching referral code:', error)
    if (error?.statusCode && error.statusCode < 500) throw error
    return { success: false, error: 'Failed to fetch referral code' }
  }
}

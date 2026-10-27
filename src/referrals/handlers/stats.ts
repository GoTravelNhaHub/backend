import { type HttpEvent } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'

/** Referral stats for the signed-in user. The client cannot pick another userId. */
export async function stats(event: HttpEvent) {
  try {
    const user = await requireUser(event.req)
    const userId = user.id

    const [totalReferrals, signedUp, completedBookings, totalRewards] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.referral.count({
        where: { referrerId: userId, status: { in: ['SIGNED_UP', 'COMPLETED_BOOKING', 'REWARDED'] } }
      }),
      prisma.referral.count({
        where: { referrerId: userId, status: { in: ['COMPLETED_BOOKING', 'REWARDED'] } }
      }),
      prisma.referral.aggregate({
        where: { referrerId: userId },
        _sum: { rewardPoints: true }
      })
    ])

    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
        signupAt: true,
        referee: { select: { id: true, firstName: true } }
      }
    })

    return {
      success: true,
      stats: {
        totalReferrals,
        signedUp,
        completedBookings,
        totalRewards: totalRewards._sum.rewardPoints || 0
      },
      recentReferrals: referrals
    }
  } catch (error: any) {
    console.error('Error fetching referral stats:', error)
    if (error?.statusCode && error.statusCode < 500) throw error
    return { success: false, error: 'Failed to fetch referral stats' }
  }
}

import prisma from '../../prisma/prisma.client'

/**
 * Credits a referral when a new account signs up with `?ref=CODE` (carried through the Keycloak
 * login by /auth/login → /auth/callback). Never throws: signup must not fail on a bad code.
 */
export async function claimReferralSignup(referralCode: unknown, userId: string) {
  if (typeof referralCode !== 'string' || referralCode.length === 0 || referralCode.length > 40) return

  try {
    const referral = await prisma.referral.findUnique({
      where: { referralCode }
    })

    if (!referral || referral.status !== 'PENDING' || referral.refereeId || referral.referrerId === userId) return

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentSignups = await prisma.referral.count({
      where: {
        referrerId: referral.referrerId,
        signupAt: { gte: dayAgo }
      }
    })

    const claimed = await prisma.referral.updateMany({
      where: { id: referral.id, status: 'PENDING', refereeId: null },
      data: {
        refereeId: userId,
        status: 'SIGNED_UP',
        signupAt: new Date()
      }
    })

    // One code pays once, and a referrer can earn at most five signup rewards a day.
    if (claimed.count === 1 && recentSignups < 5) {
      await prisma.loyaltyPoint.create({
        data: {
          userId: referral.referrerId,
          points: 100,
          reason: 'Referral signup'
        }
      })
    }
  } catch (error) {
    console.error('Error processing referral:', error)
  }
}

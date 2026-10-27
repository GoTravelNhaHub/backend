import { type HttpEvent } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { cityOf, destinationSlug } from '../../shared/utils/destination-slug'

// Destinations that have at least one bookable activity, with a count per city
export async function destinationsGet(event: HttpEvent) {
  const now = new Date()
  const entities = await prisma.affiliateEntity.findMany({
    where: {
      status: 'active',
      location: { not: null },
      offers: {
        some: {
          isActive: true,
          availabilityStatus: 'available',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        }
      }
    },
    select: { location: true }
  })

  const counts = new Map<string, { slug: string; name: string; activityCount: number }>()
  const add = (name: string, amount: number) => {
    const slug = destinationSlug(name)
    if (!slug) return
    const entry = counts.get(slug) || { slug, name, activityCount: 0 }
    entry.activityCount += amount
    counts.set(slug, entry)
  }

  for (const entity of entities) {
    if (entity.location) add(cityOf(entity.location), 1)
  }

  return {
    success: true,
    data: [...counts.values()].sort((a, b) => b.activityCount - a.activityCount)
  }
}

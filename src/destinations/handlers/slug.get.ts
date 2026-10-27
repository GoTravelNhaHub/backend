import { type HttpEvent, createError, getQuery, getRouterParam } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { getSessionUser } from '../../auth/session'
import { recommendActivities, ageOn } from '../../trips/services/trip-recommendations'
import { destinationFromSlug } from '../../shared/utils/destination-slug'

const MAX_RESULTS = 48

// Bookable activities for a destination, ranked for the family when ages or
// interests are given. ?family=1 uses the signed-in user's saved travellers.
export async function slugGet(event: HttpEvent) {
  const slug = (getRouterParam(event, 'slug') || '').toLowerCase()
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
    throw createError({ statusCode: 404, message: 'Destination not found.' })
  }
  const destination = destinationFromSlug(slug)

  const query = getQuery(event)
  let ages = String(query.ages || '')
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter((age) => Number.isInteger(age) && age >= 0 && age <= 110)
    .slice(0, 10)
  const interests = typeof query.interests === 'string' ? query.interests.slice(0, 300) : null

  let usedFamily = false
  if (!ages.length && query.family === '1') {
    const user = await getSessionUser(event.req)
    if (user) {
      const travellers = await prisma.traveller.findMany({
        where: { userId: user.id, birthDate: { not: null } },
        select: { birthDate: true }
      })
      const today = new Date().toISOString().slice(0, 10)
      ages = travellers.map((traveller) => ageOn(traveller.birthDate!, today))
      usedFamily = ages.length > 0
    }
  }

  const activities = await recommendActivities({ destination, ages, interests, limit: MAX_RESULTS })

  return {
    success: true,
    destination: { slug, name: destination },
    personalised: ages.length > 0 || !!interests,
    usedFamily,
    data: activities
  }
}

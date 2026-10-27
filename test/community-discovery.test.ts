import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { filtersToQuery, hasActiveFilters, parseCommunityFilters } from '../src/shared/utils/community-filters'

test('filters from the URL: unknown values are dropped, not rejected', () => {
  const filters = parseCommunityFilters({ q: '  Bang  kok ', duration: 'forever', budget: 'mid', style: ['packed', 'relaxed'], family: '1', sort: 'random' })
  assert.deepEqual(filters, { q: 'Bang kok', destination: undefined, country: undefined, duration: undefined, budget: 'mid', style: 'packed', family: true, sort: 'recent' })
  assert.equal(hasActiveFilters(parseCommunityFilters({ sort: 'saved' })), false)
  assert.equal(hasActiveFilters(parseCommunityFilters({ family: '0' })), false)
  assert.deepEqual(filtersToQuery({ q: 'Hanoi', family: true, sort: 'recent' }), { q: 'Hanoi', family: '1' })
  assert.equal(parseCommunityFilters({ q: 'x'.repeat(200) }).q?.length, 80)
})

// Discovery queries against a disposable database:
//   COMMUNITY_TEST_DATABASE_URL=postgresql://.../gtn_community_fresh npm test
const url = process.env.COMMUNITY_TEST_DATABASE_URL
const skip = !url
  ? 'set COMMUNITY_TEST_DATABASE_URL to a disposable, migrated database'
  : url === process.env.DATABASE_URL
    ? 'COMMUNITY_TEST_DATABASE_URL must not be the app database'
    : false
if (url && !skip) process.env.DATABASE_URL = url

let trips: typeof import('../src/community/services/trips')
let prisma: typeof import('../src/prisma/prisma.client').default
const run = randomUUID().slice(0, 8)
// Every trip in this file uses this destination, so other rows in the database do not interfere
const CITY = `Testville ${run}`
let userId = ''

const publish = (extra: Record<string, unknown>) =>
  prisma.publishedTrip.create({
    data: {
      authorId: userId,
      slug: `d-${run}-${randomUUID().slice(0, 8)}`,
      title: 'Trip',
      destination: CITY,
      durationDays: 3,
      visibility: 'PUBLIC',
      publishedAt: new Date(),
      itinerary: { title: 'Trip', summary: '', days: [{ theme: 'Lakes', items: [] }, { theme: 'Markets', items: [] }], tips: [] },
      ...extra
    }
  })

before(async () => {
  if (skip) return
  prisma = (await import('../src/prisma/prisma.client')).default
  trips = await import('../src/community/services/trips')
  const user = await prisma.user.create({ data: { username: `d_${run}`, email: `${run}.d@example.test` } })
  userId = user.id
  await prisma.travelerProfile.create({ data: { userId, handle: `d${run}`, displayName: 'Discovery' } })

  const base = Date.now()
  // 7 public trips, a second apart, plus trips that must never be listed
  for (let index = 0; index < 7; index++) {
    await publish({
      title: `Public ${index}`,
      publishedAt: new Date(base - index * 1000),
      saveCount: index === 5 ? 50 : index,
      durationDays: index + 1,
      familyFriendly: index % 2 === 0,
      budgetLevel: index < 3 ? 'budget' : 'premium',
      travelStyle: 'relaxed'
    })
  }
  await publish({ title: 'Unlisted', visibility: 'UNLISTED' })
  await publish({ title: 'Private', visibility: 'PRIVATE' })
  await publish({ title: 'Hidden', status: 'HIDDEN' })
})

after(async () => {
  if (skip) return
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.$disconnect()
})

const all = async (filters: Record<string, unknown>, limit = 3) => {
  const seen: string[] = []
  let cursor: string | undefined
  for (let page = 0; page < 10; page++) {
    const result = await trips.listPublicTrips(parseCommunityFilters({ destination: CITY, ...filters }), { cursor, limit })
    seen.push(...result.data.map((trip) => trip.title))
    if (!result.nextCursor) break
    cursor = result.nextCursor
  }
  return seen
}

test('only public, active trips are listed', { skip }, async () => {
  const titles = await all({}, 24)
  assert.equal(titles.length, 7)
  for (const hidden of ['Unlisted', 'Private', 'Hidden']) assert.equal(titles.includes(hidden), false, hidden)
})

test('newest first, paged with a cursor, no duplicates or gaps', { skip }, async () => {
  const titles = await all({}, 3)
  assert.deepEqual(titles, ['Public 0', 'Public 1', 'Public 2', 'Public 3', 'Public 4', 'Public 5', 'Public 6'])
})

test('most saved first, paged with a cursor', { skip }, async () => {
  const titles = await all({ sort: 'saved' }, 2)
  assert.deepEqual(titles, ['Public 5', 'Public 6', 'Public 4', 'Public 3', 'Public 2', 'Public 1', 'Public 0'])
})

test('filters: length, budget, family, search', { skip }, async () => {
  assert.deepEqual(await all({ duration: 'short' }, 24), ['Public 0', 'Public 1', 'Public 2'])
  assert.deepEqual(await all({ duration: 'long' }, 24), ['Public 6'])
  assert.deepEqual(await all({ budget: 'budget' }, 24), ['Public 0', 'Public 1', 'Public 2'])
  assert.deepEqual(await all({ family: '1' }, 24), ['Public 0', 'Public 2', 'Public 4', 'Public 6'])
  assert.deepEqual(await all({ q: 'public 3' }, 24), ['Public 3'])
  assert.deepEqual(await all({ style: 'packed' }, 24), [])
})

test('cards carry day themes and the author, nothing private', { skip }, async () => {
  const { data } = await trips.listPublicTrips(parseCommunityFilters({ destination: CITY }), { limit: 1 })
  assert.deepEqual(data[0].highlights, ['Lakes', 'Markets'])
  assert.deepEqual(Object.keys(data[0].author).sort(), ['avatarUrl', 'displayName', 'handle'])
  assert.equal('itinerary' in data[0], false)
})

test('a tampered cursor is ignored, not an error', { skip }, async () => {
  const result = await trips.listPublicTrips(parseCommunityFilters({ destination: CITY }), { cursor: 'not-a-cursor', limit: 2 })
  assert.equal(result.data[0].title, 'Public 0')
})

test('popular destinations count public trips only', { skip }, async () => {
  const destinations = await trips.popularDestinations(100)
  assert.equal(destinations.find((item) => item.destination === CITY)?.count, 7)
})

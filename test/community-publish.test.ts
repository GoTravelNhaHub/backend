import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'

// Publishing and read rules in src/community/services, against a disposable database:
//   COMMUNITY_TEST_DATABASE_URL=postgresql://.../gtn_community_fresh npm test
const url = process.env.COMMUNITY_TEST_DATABASE_URL
const skip = !url
  ? 'set COMMUNITY_TEST_DATABASE_URL to a disposable, migrated database'
  : url === process.env.DATABASE_URL
    ? 'COMMUNITY_TEST_DATABASE_URL must not be the app database'
    : false

// The services use the app's Prisma singleton, which reads DATABASE_URL when first imported
if (url && !skip) process.env.DATABASE_URL = url

type Services = typeof import('../src/community/services/trips')
type Profiles = typeof import('../src/community/services/profile')
let trips: Services
let profiles: Profiles
let prisma: typeof import('../src/prisma/prisma.client').default

const run = randomUUID().slice(0, 8)
const userIds: string[] = []

const makeUser = async (name: string, firstName: string | null = null) => {
  const user = await prisma.user.create({ data: { username: `p_${run}_${name}`, email: `${run}.${name}@example.test`, firstName } })
  userIds.push(user.id)
  return user
}

const makeTrip = (userId: string) =>
  prisma.trip.create({
    data: {
      userId,
      title: "Mia's Bangkok week",
      destination: 'Bangkok',
      startDate: new Date('2027-03-14'),
      endDate: new Date('2027-03-16'),
      budget: 1800,
      party: [{ name: 'Tuan', age: 38 }, { name: 'Mia', age: 6 }],
      preferences: { pace: 'relaxed' },
      itinerary: {
        title: "Mia's Bangkok week",
        summary: 'Easy days for Mia and Tuan.',
        days: [
          { date: '2027-03-14', theme: 'Arrival', items: [{ slot: 'morning', activityId: null, title: 'Lumpini Park', description: 'Mia can feed the ducks.', familyTip: null }] },
          { date: '2027-03-15', theme: 'Markets', items: [] },
          { date: '2027-03-16', theme: 'Home', items: [] }
        ],
        tips: ['Tuan should book a Grab early.']
      }
    }
  })

const input = (tripId: string, extra: Record<string, unknown> = {}) =>
  trips.PublishInputSchema.parse({ tripId, title: "Mia's Bangkok week", ...extra })

const status = async (promise: Promise<unknown>) => {
  try {
    await promise
    return 200
  } catch (error: any) {
    return error?.statusCode ?? 500
  }
}

let author: Awaited<ReturnType<typeof makeUser>>
let stranger: Awaited<ReturnType<typeof makeUser>>

before(async () => {
  if (skip) return
  prisma = (await import('../src/prisma/prisma.client')).default
  trips = await import('../src/community/services/trips')
  profiles = await import('../src/community/services/profile')
  author = await makeUser('author', 'Tuan')
  stranger = await makeUser('stranger')
  await profiles.saveOwnProfile(author.id, { handle: `a${run}`, displayName: 'Bangkok parent' })
})

after(async () => {
  if (skip) return
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
})

test('nobody can preview or publish another user’s trip', { skip }, async () => {
  const trip = await makeTrip(author.id)
  await profiles.saveOwnProfile(stranger.id, { handle: `s${run}`, displayName: 'Stranger' })
  assert.equal(await status(trips.previewPublication(stranger, trip.id)), 404)
  assert.equal(await status(trips.publishTrip(stranger, input(trip.id))), 404)
})

test('publishing needs a traveler profile', { skip }, async () => {
  const user = await makeUser('noprofile')
  const trip = await makeTrip(user.id)
  assert.equal(await status(trips.publishTrip(user, input(trip.id))), 409)
})

test('a published trip is private by default and holds no names, dates or budget', { skip }, async () => {
  const trip = await makeTrip(author.id)
  const published = await trips.publishTrip(author, input(trip.id))
  assert.equal(published.visibility, 'PRIVATE')
  assert.match(published.slug, /^the-kids-bangkok-week-[0-9a-f]{6}$/)

  const row = await prisma.publishedTrip.findUniqueOrThrow({ where: { id: published.id } })
  const json = JSON.stringify(row)
  for (const secret of ['Mia', 'Tuan', '2027-03-1', '1800']) assert.equal(json.includes(secret), false, secret)
  assert.equal(row.publishedAt, null)
  assert.equal(row.travelMonth, null)
  assert.deepEqual(row.childAgeBands, [])
  assert.equal(row.durationDays, 3)
})

test('public needs explicit confirmation', { skip }, async () => {
  assert.throws(() => input(randomUUID(), { visibility: 'PUBLIC' }))
  assert.doesNotThrow(() => input(randomUUID(), { visibility: 'PUBLIC', confirmPublic: true }))
})

test('republishing updates the same row and keeps the slug and first publish date', { skip }, async () => {
  const trip = await makeTrip(author.id)
  const first = await trips.publishTrip(author, input(trip.id, { visibility: 'PUBLIC', confirmPublic: true }))
  const { publishedAt } = await prisma.publishedTrip.findUniqueOrThrow({ where: { id: first.id } })
  assert.ok(publishedAt)

  const second = await trips.publishTrip(author, input(trip.id, { title: 'A calmer Bangkok', showTravelMonth: true, showChildAges: true }))
  assert.equal(second.id, first.id)
  assert.equal(second.slug, first.slug)
  assert.equal(second.title, 'A calmer Bangkok')
  assert.equal(second.travelMonth, 3)
  assert.deepEqual(second.childAgeBands, ['6-12'])
  assert.equal(await prisma.publishedTrip.count({ where: { sourceTripId: trip.id } }), 1)
  const after = await prisma.publishedTrip.findUniqueOrThrow({ where: { id: first.id } })
  assert.equal(after.publishedAt?.getTime(), publishedAt!.getTime())
})

test('who can read a published trip', { skip }, async () => {
  const trip = await makeTrip(author.id)
  const published = await trips.publishTrip(author, input(trip.id))
  const read = (viewerId: string | null) => status(trips.getTripForViewer(published.slug, viewerId))

  // Private: author only
  assert.equal(await read(null), 404)
  assert.equal(await read(stranger.id), 404)
  assert.equal(await read(author.id), 200)
  const own = await trips.getTripForViewer(published.slug, author.id)
  assert.equal(own.viewerIsAuthor, true)
  assert.equal(own.sourceTripId, trip.id)

  // Unlisted: anyone with the link, but not told where it came from
  await trips.setVisibility(author, published.id, { visibility: 'UNLISTED', confirmPublic: false })
  assert.equal(await read(null), 200)
  const other = await trips.getTripForViewer(published.slug, stranger.id)
  assert.equal(other.viewerIsAuthor, false)
  assert.equal(other.sourceTripId, null)

  // Hidden by a moderator: author only, even when public
  await trips.setVisibility(author, published.id, { visibility: 'PUBLIC', confirmPublic: true })
  await prisma.publishedTrip.update({ where: { id: published.id }, data: { status: 'HIDDEN' } })
  assert.equal(await read(null), 404)
  assert.equal(await read(author.id), 200)

  // Removed: nobody
  await prisma.publishedTrip.update({ where: { id: published.id }, data: { status: 'REMOVED' } })
  assert.equal(await read(author.id), 404)
  assert.equal(await status(trips.publishTrip(author, input(trip.id))), 403)
})

test('a suspended author’s trips disappear from public view', { skip }, async () => {
  const user = await makeUser('suspended')
  await profiles.saveOwnProfile(user.id, { handle: `x${run}`, displayName: 'Soon suspended' })
  const trip = await makeTrip(user.id)
  const published = await trips.publishTrip(user, input(trip.id, { visibility: 'PUBLIC', confirmPublic: true }))
  await prisma.travelerProfile.update({ where: { userId: user.id }, data: { status: 'HIDDEN' } })
  assert.equal(await status(trips.getTripForViewer(published.slug, null)), 404)
  assert.equal((await trips.listIndexableTrips()).some((item) => item.slug === published.slug), false)
  assert.equal(await status(profiles.saveOwnProfile(user.id, { handle: `x${run}`, displayName: 'Back' })), 403)
})

test('only the author can change visibility or remove; removing keeps the private trip', { skip }, async () => {
  const trip = await makeTrip(author.id)
  const published = await trips.publishTrip(author, input(trip.id))
  assert.equal(await status(trips.setVisibility(stranger, published.id, { visibility: 'PUBLIC', confirmPublic: true })), 404)
  assert.equal(await status(trips.deletePublication(stranger, published.id)), 404)

  await trips.deletePublication(author, published.id)
  assert.equal(await prisma.publishedTrip.count({ where: { id: published.id } }), 0)
  assert.equal(await prisma.trip.count({ where: { id: trip.id } }), 1)
})

test('only public, active trips are listed for the sitemap', { skip }, async () => {
  const [a, b, c] = await Promise.all([makeTrip(author.id), makeTrip(author.id), makeTrip(author.id)])
  const visible = await trips.publishTrip(author, input(a.id, { visibility: 'PUBLIC', confirmPublic: true }))
  const unlisted = await trips.publishTrip(author, input(b.id, { visibility: 'UNLISTED' }))
  const hidden = await trips.publishTrip(author, input(c.id, { visibility: 'PUBLIC', confirmPublic: true }))
  await prisma.publishedTrip.update({ where: { id: hidden.id }, data: { status: 'HIDDEN' } })

  const slugs = new Set((await trips.listIndexableTrips()).map((item) => item.slug))
  assert.equal(slugs.has(visible.slug), true)
  assert.equal(slugs.has(unlisted.slug), false)
  assert.equal(slugs.has(hidden.slug), false)
})

test('handles: taken and reserved handles are refused', { skip }, async () => {
  const user = await makeUser('handles', 'Tuan')
  assert.equal(await status(profiles.saveOwnProfile(user.id, { handle: `a${run}`, displayName: 'Copycat' })), 409)
  assert.equal(await status(profiles.saveOwnProfile(user.id, { handle: 'gotravelnha', displayName: 'Fake' })), 400)
  assert.equal(await status(profiles.saveOwnProfile(user.id, { handle: 'Has Spaces', displayName: 'x' })), 400)
  const suggestion = await profiles.suggestFreeHandle('Tuan')
  assert.match(suggestion, /^tuan_\d{4}$/)
  assert.equal(suggestion.includes(run), false)
})

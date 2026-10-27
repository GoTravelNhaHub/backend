import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { PrismaClient } from '@prisma/client'

// Database rules behind the community API: unique saves and follows, CHECK constraints
// and what deleting a user or a private trip does. Runs only against a disposable database:
//   COMMUNITY_TEST_DATABASE_URL=postgresql://.../gtn_community_fresh npm test
const url = process.env.COMMUNITY_TEST_DATABASE_URL
const skip = !url
  ? 'set COMMUNITY_TEST_DATABASE_URL to a disposable, migrated database'
  : url === process.env.DATABASE_URL
    ? 'COMMUNITY_TEST_DATABASE_URL must not be the app database'
    : false

const prisma = new PrismaClient(url ? { datasourceUrl: url } : undefined)
const run = randomUUID().slice(0, 8)
const userIds: string[] = []

const makeUser = async (name: string) => {
  const user = await prisma.user.create({ data: { username: `t_${run}_${name}`, email: `${run}.${name}@example.test` } })
  userIds.push(user.id)
  return user
}

const makeProfile = (userId: string, name: string) =>
  prisma.travelerProfile.create({ data: { userId, handle: `t${run}_${name}`, displayName: name } })

const makeTrip = (userId: string) =>
  prisma.trip.create({
    data: {
      userId,
      title: 'Test trip',
      destination: 'Bangkok',
      startDate: new Date('2027-01-01'),
      endDate: new Date('2027-01-03'),
      party: [{ name: 'Mia', age: 6 }],
      itinerary: { title: 'Test', summary: '', days: [], tips: [] }
    }
  })

const publish = (authorId: string, extra: Record<string, unknown> = {}) =>
  prisma.publishedTrip.create({
    data: {
      authorId,
      slug: `t-${run}-${randomUUID().slice(0, 8)}`,
      title: '3 days in Bangkok',
      destination: 'Bangkok',
      durationDays: 3,
      itinerary: { title: '3 days in Bangkok', summary: '', days: [], tips: [] },
      ...extra
    }
  })

let author: Awaited<ReturnType<typeof makeUser>>
let reader: Awaited<ReturnType<typeof makeUser>>

before(async () => {
  if (skip) return
  author = await makeUser('author')
  reader = await makeUser('reader')
  await makeProfile(author.id, 'author')
})

after(async () => {
  if (!skip) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
})

test('published trips are private and active by default', { skip }, async () => {
  const trip = await publish(author.id)
  assert.equal(trip.visibility, 'PRIVATE')
  assert.equal(trip.status, 'ACTIVE')
  assert.equal(trip.publishedAt, null)
})

test('a user can save a trip only once', { skip }, async () => {
  const trip = await publish(author.id)
  await prisma.savedTrip.create({ data: { userId: reader.id, tripId: trip.id } })
  await assert.rejects(prisma.savedTrip.create({ data: { userId: reader.id, tripId: trip.id } }), { code: 'P2002' })
})

test('follows are unique and cannot target yourself', { skip }, async () => {
  await prisma.follow.create({ data: { followerId: reader.id, followeeId: author.id } })
  await assert.rejects(prisma.follow.create({ data: { followerId: reader.id, followeeId: author.id } }), { code: 'P2002' })
  await assert.rejects(prisma.follow.create({ data: { followerId: author.id, followeeId: author.id } }), /follows_not_self/)
})

test('handles must be lowercase a-z, 0-9 or _, 3-30 characters', { skip }, async () => {
  const user = await makeUser('handle')
  for (const handle of ['Ab_cd', 'ab', 'has space', 'a'.repeat(31), 'dot.name']) {
    await assert.rejects(
      prisma.travelerProfile.create({ data: { userId: user.id, handle, displayName: 'x' } }),
      /traveler_profiles_handle_format/,
      handle
    )
  }
  await makeProfile(user.id, 'ok')
})

test('duration, travel month and comment length are bounded', { skip }, async () => {
  await assert.rejects(publish(author.id, { durationDays: 0 }), /published_trips_duration_range/)
  await assert.rejects(publish(author.id, { travelMonth: 13 }), /published_trips_travel_month_range/)
  const trip = await publish(author.id)
  await assert.rejects(prisma.tripComment.create({ data: { tripId: trip.id, authorId: reader.id, body: '' } }), /trip_comments_body_length/)
  await assert.rejects(
    prisma.tripComment.create({ data: { tripId: trip.id, authorId: reader.id, body: 'x'.repeat(2001) } }),
    /trip_comments_body_length/
  )
})

test('a private trip has at most one published version, which outlives it', { skip }, async () => {
  const source = await makeTrip(author.id)
  const published = await publish(author.id, { sourceTripId: source.id })
  await assert.rejects(publish(author.id, { sourceTripId: source.id }), { code: 'P2002' })

  await prisma.trip.delete({ where: { id: source.id } })
  const kept = await prisma.publishedTrip.findUnique({ where: { id: published.id } })
  assert.equal(kept?.sourceTripId, null)
})

test('adapted versions keep working when the original is deleted', { skip }, async () => {
  const original = await publish(author.id)
  const child = await publish(author.id, { parentId: original.id })
  const adapted = await prisma.trip.update({ where: { id: (await makeTrip(reader.id)).id }, data: { adaptedFromId: original.id } })

  await prisma.publishedTrip.delete({ where: { id: original.id } })
  assert.equal((await prisma.publishedTrip.findUnique({ where: { id: child.id } }))?.parentId, null)
  assert.equal((await prisma.trip.findUnique({ where: { id: adapted.id } }))?.adaptedFromId, null)
})

test('deleting an account removes its social data and anonymises its comments', { skip }, async () => {
  const leaving = await makeUser('leaving')
  await makeProfile(leaving.id, 'leaving')
  const ownTrip = await publish(leaving.id)
  const otherTrip = await publish(author.id)
  await prisma.savedTrip.create({ data: { userId: leaving.id, tripId: otherTrip.id } })
  await prisma.follow.create({ data: { followerId: leaving.id, followeeId: author.id } })
  const comment = await prisma.tripComment.create({ data: { tripId: otherTrip.id, authorId: leaving.id, body: 'Go early.' } })
  await prisma.contentReport.create({ data: { reporterId: leaving.id, targetType: 'TRIP', targetId: otherTrip.id, reason: 'spam' } })

  await prisma.user.delete({ where: { id: leaving.id } })

  assert.equal(await prisma.travelerProfile.count({ where: { userId: leaving.id } }), 0)
  assert.equal(await prisma.publishedTrip.count({ where: { id: ownTrip.id } }), 0)
  assert.equal(await prisma.savedTrip.count({ where: { userId: leaving.id } }), 0)
  assert.equal(await prisma.follow.count({ where: { followerId: leaving.id } }), 0)
  assert.equal((await prisma.tripComment.findUnique({ where: { id: comment.id } }))?.authorId, null)
  assert.equal(await prisma.contentReport.count({ where: { targetId: otherTrip.id, reporterId: null } }), 1)
})

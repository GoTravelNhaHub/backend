import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'

// Saving trips and the Customize-with-AI source rules, against a disposable database:
//   COMMUNITY_TEST_DATABASE_URL=postgresql://.../gtn_community_fresh npm test
const url = process.env.COMMUNITY_TEST_DATABASE_URL
const skip = !url
  ? 'set COMMUNITY_TEST_DATABASE_URL to a disposable, migrated database'
  : url === process.env.DATABASE_URL
    ? 'COMMUNITY_TEST_DATABASE_URL must not be the app database'
    : false

// The services use the app's Prisma singleton, which reads DATABASE_URL when first imported
if (url && !skip) process.env.DATABASE_URL = url

let social: typeof import('../src/community/services/social')
let trips: typeof import('../src/community/services/trips')
let prisma: typeof import('../src/prisma/prisma.client').default

const run = randomUUID().slice(0, 8)
const userIds: string[] = []

const makeUser = async (name: string) => {
  const user = await prisma.user.create({ data: { username: `s_${run}_${name}`, email: `${run}.${name}@example.test` } })
  userIds.push(user.id)
  return user
}

const makePublished = async (authorId: string, name: string, visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE', status: 'ACTIVE' | 'HIDDEN' = 'ACTIVE') =>
  prisma.publishedTrip.create({
    data: {
      slug: `${name}-${run}`,
      authorId,
      visibility,
      status,
      title: `Trip ${name}`,
      destination: 'Singapore',
      durationDays: 2,
      itinerary: { title: 'x', summary: 'x', days: [{ theme: 'x', items: [] }, { theme: 'y', items: [] }], tips: [] },
      tips: [],
      publishedAt: visibility === 'PUBLIC' ? new Date() : null
    }
  })

let author: { id: string }
let reader: { id: string }

before(async () => {
  if (skip) return
  prisma = (await import('../src/prisma/prisma.client')).default
  social = await import('../src/community/services/social')
  trips = await import('../src/community/services/trips')
  author = await makeUser('author')
  reader = await makeUser('reader')
  await prisma.travelerProfile.create({ data: { userId: author.id, handle: `a_${run}`, displayName: 'Author' } })
})

after(async () => {
  if (skip) return
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
})

test('saving is idempotent and keeps the count in step', { skip }, async () => {
  const trip = await makePublished(author.id, 'save', 'PUBLIC')
  assert.deepEqual(await social.saveTrip(reader.id, trip.slug), { saved: true, saveCount: 1 })
  assert.deepEqual(await social.saveTrip(reader.id, trip.slug), { saved: true, saveCount: 1 }, 'second save is a no-op')
  assert.deepEqual(await social.savedState(reader.id, [trip.id, randomUUID()]), [trip.id])
  assert.deepEqual(await social.unsaveTrip(reader.id, trip.slug), { saved: false, saveCount: 0 })
  assert.deepEqual(await social.unsaveTrip(reader.id, trip.slug), { saved: false, saveCount: 0 }, 'never below zero')
})

test('private and hidden trips cannot be saved by others; unlisted can', { skip }, async () => {
  const privateTrip = await makePublished(author.id, 'private', 'PRIVATE')
  const hidden = await makePublished(author.id, 'hidden', 'PUBLIC', 'HIDDEN')
  const unlisted = await makePublished(author.id, 'unlisted', 'UNLISTED')
  await assert.rejects(social.saveTrip(reader.id, privateTrip.slug), { statusCode: 404 })
  await assert.rejects(social.saveTrip(reader.id, hidden.slug), { statusCode: 404 })
  assert.equal((await social.saveTrip(reader.id, unlisted.slug)).saved, true)
})

test('the saved list leaves out trips that stopped being visible', { skip }, async () => {
  const trip = await makePublished(author.id, 'later-hidden', 'PUBLIC')
  await social.saveTrip(reader.id, trip.slug)
  assert.ok((await social.listSaved(reader.id)).data.some((card) => card.id === trip.id))
  await prisma.publishedTrip.update({ where: { id: trip.id }, data: { status: 'HIDDEN' } })
  assert.ok(!(await social.listSaved(reader.id)).data.some((card) => card.id === trip.id))
})

test('only public or unlisted, active trips can be customized with AI', { skip }, async () => {
  const pub = await makePublished(author.id, 'adapt-public', 'PUBLIC')
  const unlisted = await makePublished(author.id, 'adapt-unlisted', 'UNLISTED')
  const priv = await makePublished(author.id, 'adapt-private', 'PRIVATE')
  const hidden = await makePublished(author.id, 'adapt-hidden', 'PUBLIC', 'HIDDEN')
  assert.equal((await trips.adaptationSource(pub.id))?.id, pub.id)
  assert.equal((await trips.adaptationSource(unlisted.id))?.id, unlisted.id)
  assert.equal(await trips.adaptationSource(priv.id), null)
  assert.equal(await trips.adaptationSource(hidden.id), null)
})

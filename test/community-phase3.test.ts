import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'

// Phase 3: follows, traveler profiles, comments and moderation.
// Pure tests always run; database tests need a disposable, migrated database:
//   COMMUNITY_TEST_DATABASE_URL=postgresql://.../gtn_community_fresh npm test
const url = process.env.COMMUNITY_TEST_DATABASE_URL
const skip = !url
  ? 'set COMMUNITY_TEST_DATABASE_URL to a disposable, migrated database'
  : url === process.env.DATABASE_URL
    ? 'COMMUNITY_TEST_DATABASE_URL must not be the app database'
    : false
if (url && !skip) process.env.DATABASE_URL = url

let social: typeof import('../src/community/services/social')
let travelers: typeof import('../src/community/services/travelers')
let comments: typeof import('../src/community/services/comments')
let moderation: typeof import('../src/community/services/moderation')
let trips: typeof import('../src/community/services/trips')
let prisma: typeof import('../src/prisma/prisma.client').default

test('comment text: trimmed, extra blank lines collapsed, control characters removed, length enforced', async () => {
  const { cleanCommentBody, MAX_COMMENT_LENGTH } = await import('../src/community/services/comments')
  assert.equal(cleanCommentBody('  Bring a hat \r\n\r\n\r\n\r\nand water\u0007  '), 'Bring a hat\n\nand water')
  assert.throws(() => cleanCommentBody('   \n  '), { statusCode: 400 })
  assert.equal(cleanCommentBody('a'.repeat(MAX_COMMENT_LENGTH)).length, MAX_COMMENT_LENGTH)
  assert.throws(() => cleanCommentBody('a'.repeat(MAX_COMMENT_LENGTH + 1)), { statusCode: 400 })
})

const run = randomUUID().slice(0, 8)
const userIds: string[] = []
const makeUser = async (name: string, role: 'USER' | 'ADMIN' = 'USER') => {
  const user = await prisma.user.create({ data: { username: `p3_${run}_${name}`, email: `${run}.${name}@example.test`, role } })
  userIds.push(user.id)
  return user
}
const makeProfile = (userId: string, handle: string) =>
  prisma.travelerProfile.create({ data: { userId, handle: `${handle}_${run}`, displayName: handle } })
const makeTrip = (authorId: string, name: string, visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE' = 'PUBLIC') =>
  prisma.publishedTrip.create({
    data: {
      slug: `${name}-${run}`,
      authorId,
      visibility,
      title: `Trip ${name}`,
      destination: 'Singapore',
      durationDays: 1,
      itinerary: { title: 'x', summary: 'x', days: [{ theme: 'x', items: [] }], tips: [] },
      tips: [],
      publishedAt: visibility === 'PUBLIC' ? new Date() : null
    }
  })

let author: { id: string }
let reader: { id: string }
let noProfile: { id: string }
let admin: { id: string; role: string }
let authorHandle = ''
let readerHandle = ''

before(async () => {
  if (skip) return
  prisma = (await import('../src/prisma/prisma.client')).default
  social = await import('../src/community/services/social')
  travelers = await import('../src/community/services/travelers')
  comments = await import('../src/community/services/comments')
  moderation = await import('../src/community/services/moderation')
  trips = await import('../src/community/services/trips')
  author = await makeUser('author')
  reader = await makeUser('reader')
  noProfile = await makeUser('lurker')
  admin = await makeUser('admin', 'ADMIN')
  authorHandle = (await makeProfile(author.id, 'author')).handle
  readerHandle = (await makeProfile(reader.id, 'reader')).handle
})

after(async () => {
  if (skip) return
  await prisma.contentReport.deleteMany({ where: { reporterId: { in: userIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
})

test('follow: idempotent, counted, no self-follow, suspended profiles cannot be followed', { skip }, async () => {
  assert.deepEqual(await social.followTraveler(reader.id, authorHandle), { following: true, followers: 1 })
  assert.deepEqual(await social.followTraveler(reader.id, authorHandle), { following: true, followers: 1 })
  // Following needs no public profile of your own
  assert.equal((await social.followTraveler(noProfile.id, authorHandle)).followers, 2)
  assert.deepEqual(await social.followState(reader.id, [authorHandle, readerHandle]), [authorHandle])
  await assert.rejects(social.followTraveler(author.id, authorHandle), { statusCode: 400 })
  assert.deepEqual(await social.unfollowTraveler(noProfile.id, authorHandle), { following: false, followers: 1 })

  const suspended = await makeUser('suspended')
  const profile = await makeProfile(suspended.id, 'suspended')
  await prisma.travelerProfile.update({ where: { userId: suspended.id }, data: { status: 'HIDDEN' } })
  await assert.rejects(social.followTraveler(reader.id, profile.handle), { statusCode: 404 })
})

test('traveler profile: public counts only, suspended looks missing', { skip }, async () => {
  await makeTrip(author.id, 'profile-public')
  await makeTrip(author.id, 'profile-private', 'PRIVATE')
  const view = await travelers.getTraveler(authorHandle)
  assert.equal(view.counts.trips, 1, 'private trips are not counted')
  assert.equal(view.counts.followers, 1)
  assert.equal(Object.keys(view).includes('email'), false)
  const list = await travelers.listTravelerTrips(authorHandle)
  assert.deepEqual(list.data.map((trip) => trip.slug), [`profile-public-${run}`])
  await assert.rejects(travelers.getTraveler(`nobody_${run}`), { statusCode: 404 })
})

test('comments: need a profile and a visible trip; count kept in step', { skip }, async () => {
  const trip = await makeTrip(author.id, 'comments')
  const privateTrip = await makeTrip(author.id, 'comments-private', 'PRIVATE')
  await assert.rejects(comments.addComment(noProfile.id, trip.slug, { body: 'Hi', kind: 'TIP' }), { statusCode: 409 })
  await assert.rejects(comments.addComment(reader.id, privateTrip.slug, { body: 'Hi', kind: 'TIP' }), { statusCode: 404 })

  const first = await comments.addComment(reader.id, trip.slug, { body: 'Go early to beat the heat', kind: 'TIP' })
  await comments.addComment(author.id, trip.slug, { body: 'Thanks!', kind: 'TIP' })
  assert.equal((await prisma.publishedTrip.findUnique({ where: { id: trip.id } }))!.commentCount, 2)

  const listed = await comments.listComments(trip.slug, reader.id)
  assert.equal(listed.data.length, 2)
  const mine = listed.data.find((comment) => comment.id === first.id)!
  assert.equal(mine.mine, true)
  assert.equal(mine.author?.handle, readerHandle)

  // Only the author edits; author or admin deletes
  await assert.rejects(comments.editComment(author.id, first.id, 'changed'), { statusCode: 404 })
  await comments.editComment(reader.id, first.id, 'Go early, bring water')
  assert.ok((await prisma.tripComment.findUnique({ where: { id: first.id } }))!.editedAt)
  await assert.rejects(comments.deleteComment({ id: author.id, role: 'USER' }, first.id), { statusCode: 404 })
  await comments.deleteComment(admin, first.id)
  assert.equal((await prisma.publishedTrip.findUnique({ where: { id: trip.id } }))!.commentCount, 1)
})

test('comments: hourly cap per user', { skip }, async () => {
  const trip = await makeTrip(author.id, 'cap')
  const spammer = await makeUser('spammer')
  await makeProfile(spammer.id, 'spammer')
  await prisma.tripComment.createMany({ data: Array.from({ length: comments.COMMENTS_PER_HOUR }, () => ({ tripId: trip.id, authorId: spammer.id, body: 'x' })) })
  await assert.rejects(comments.addComment(spammer.id, trip.slug, { body: 'one more', kind: 'TIP' }), { statusCode: 429 })
})

test('reports are one per user and target; hiding is reversible and keeps counts right', { skip }, async () => {
  const trip = await makeTrip(author.id, 'moderated')
  const comment = await comments.addComment(author.id, trip.slug, { body: 'Buy my tours at example.com', kind: 'TIP' })

  await moderation.reportContent(reader.id, { targetType: 'COMMENT', target: comment.id, reason: 'spam' })
  await moderation.reportContent(reader.id, { targetType: 'COMMENT', target: comment.id, reason: 'offensive' })
  assert.equal(await prisma.contentReport.count({ where: { targetId: comment.id } }), 1)
  const queue = await moderation.listReportQueue('OPEN')
  assert.ok(queue.some((item) => item.target.id === comment.id && item.reasons.includes('offensive')))

  await moderation.moderate(admin.id, { targetType: 'COMMENT', targetId: comment.id, action: 'hide' })
  assert.equal((await prisma.publishedTrip.findUnique({ where: { id: trip.id } }))!.commentCount, 0)
  assert.equal((await comments.listComments(trip.slug, null)).data.length, 0)
  assert.equal((await prisma.contentReport.findFirst({ where: { targetId: comment.id } }))!.status, 'ACTIONED')

  await moderation.moderate(admin.id, { targetType: 'COMMENT', targetId: comment.id, action: 'restore' })
  assert.equal((await prisma.publishedTrip.findUnique({ where: { id: trip.id } }))!.commentCount, 1)

  // A hidden trip disappears from public reads; dismiss leaves the target alone
  await moderation.reportContent(reader.id, { targetType: 'TRIP', target: trip.slug, reason: 'unsafe' })
  await moderation.moderate(admin.id, { targetType: 'TRIP', targetId: trip.id, action: 'hide' })
  await assert.rejects(trips.getTripForViewer(trip.slug, null), { statusCode: 404 })
  assert.equal((await trips.getTripForViewer(trip.slug, author.id)).view.status, 'HIDDEN', 'the author still sees it')
  await moderation.moderate(admin.id, { targetType: 'TRIP', targetId: trip.id, action: 'restore' })

  await moderation.reportContent(author.id, { targetType: 'PROFILE', target: readerHandle, reason: 'other' })
  await moderation.moderate(admin.id, { targetType: 'PROFILE', targetId: reader.id, action: 'dismiss' })
  assert.equal((await prisma.contentReport.findFirst({ where: { targetId: reader.id } }))!.status, 'DISMISSED')
  assert.equal((await travelers.getTraveler(readerHandle)).handle, readerHandle)

  // Private content cannot be reported (the reporter could not have seen it)
  const privateTrip = await makeTrip(author.id, 'report-private', 'PRIVATE')
  await assert.rejects(moderation.reportContent(reader.id, { targetType: 'TRIP', target: privateTrip.slug, reason: 'spam' }), { statusCode: 404 })
})

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { renderAdaptation } from '../src/planner/services/itinerary-generator'
import { takeAdaptHandoff, writeAdaptHandoff } from '../src/shared/utils/community-adapt'

// Customize with AI: the reference plan sent to the model, and the form → planner handoff

test('the reference plan is wrapped as data and keeps only plan fields', () => {
  const block = renderAdaptation({
    title: 'Singapore weekend',
    durationDays: 2,
    itinerary: {
      summary: 'Two easy days',
      days: [{ theme: 'Gardens', items: [{ slot: 'morning', activityId: 'sg:1', title: 'Gardens by the Bay', description: 'Cloud Forest' }] }],
      tips: ['Bring water']
    }
  })
  assert.match(block, /^\n\n<reference_plan>\n/)
  assert.match(block, /<\/reference_plan>$/)
  const json = JSON.parse(block.replace(/^\n\n<reference_plan>\n/, '').replace(/\n<\/reference_plan>$/, ''))
  assert.deepEqual(Object.keys(json).sort(), ['days', 'plan', 'summary', 'tips', 'title'])
  assert.deepEqual(json.plan[0], { day: 1, theme: 'Gardens', items: [{ slot: 'morning', activityId: 'sg:1', title: 'Gardens by the Bay', description: 'Cloud Forest' }] })
})

// Minimal sessionStorage for node
const store = new Map<string, string>()
;(globalThis as any).sessionStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key)
}
afterEach(() => store.clear())

const handoff = {
  slug: 'singapore-weekend-abc123',
  tripId: '7b6f1d0e-1c2b-4d3a-9e8f-0a1b2c3d4e5f',
  startDate: '2027-01-10',
  endDate: '2027-01-12',
  adults: 2,
  childAges: [5],
  budget: 1500,
  interests: 'food',
  pace: 'relaxed' as const
}

test('handoff is read once, for the same trip only', () => {
  writeAdaptHandoff(handoff)
  assert.equal(takeAdaptHandoff('another-trip-xyz'), null)
  writeAdaptHandoff(handoff)
  const value = takeAdaptHandoff(handoff.slug)
  assert.equal(value?.tripId, handoff.tripId)
  assert.deepEqual(value?.childAges, [5])
  assert.equal(takeAdaptHandoff(handoff.slug), null, 'removed after the first read')
})

test('stale or tampered handoffs are ignored or clamped', () => {
  store.set('gotravelnha_adapt_request', JSON.stringify({ ...handoff, createdAt: Date.now() - 60 * 60 * 1000 }))
  assert.equal(takeAdaptHandoff(handoff.slug), null, 'older than 15 minutes')

  store.set('gotravelnha_adapt_request', JSON.stringify({ ...handoff, startDate: 'next week', createdAt: Date.now() }))
  assert.equal(takeAdaptHandoff(handoff.slug), null, 'bad date')

  store.set('gotravelnha_adapt_request', JSON.stringify({ ...handoff, adults: 99, childAges: [3, 40, -1, 'x'], budget: -5, pace: 'sprint', createdAt: Date.now() }))
  const value = takeAdaptHandoff(handoff.slug)
  assert.equal(value?.adults, 8)
  assert.deepEqual(value?.childAges, [3])
  assert.equal(value?.budget, null)
  assert.equal(value?.pace, null)
})

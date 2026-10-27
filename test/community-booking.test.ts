import assert from 'node:assert/strict'
import { test } from 'node:test'
import { daySuggestions, klookQuery, klookSearchUrl } from '../src/shared/utils/community-booking'
import type { ItineraryItem, LiveActivity } from '../src/shared/types/trip'

// Per-day Trip.com / Klook suggestions on community trip pages (docs/community-visual-spec.md §6)

const item = (title: string, activityId: string | null = null): ItineraryItem => ({ slot: 'morning', activityId, title, description: '', familyTip: null })

const activity = (id: string, overrides: Partial<LiveActivity> = {}): LiveActivity => ({
  id,
  kind: 'offer',
  title: `Activity ${id}`,
  image: null,
  category: null,
  available: true,
  priceFrom: 42,
  currency: 'SGD',
  priceText: null,
  href: null,
  offerId: `offer-${id}`,
  provider: 'klook',
  checkedAt: '2026-10-01T00:00:00.000Z',
  verified: true,
  location: null,
  ...overrides
})

test('hotels: first day only, and only for cities Trip.com search knows', () => {
  const days = [{ theme: 'Arrive', items: [] }, { theme: 'Zoo', items: [] }]
  const known = daySuggestions(days, {}, 'Singapore')
  assert.equal(known[0].hotels?.city, 'Singapore')
  assert.match(known[0].hotels!.url, /^https:\/\/www\.trip\.com\/hotels\/list\?city=73/)
  assert.doesNotMatch(known[0].hotels!.url, /checkIn/, 'published trips have no dates, so none are invented')
  assert.equal(known[1].hotels, null)
  assert.equal(daySuggestions(days, {}, 'Reykjavik')[0].hotels, null)
})

test('verified catalogue activities become offers; unverified ones never carry a price', () => {
  const activities = { a: activity('a'), b: activity('b', { verified: false }) }
  const [day] = daySuggestions([{ theme: 'Fun', items: [item('Zoo trip', 'a'), item('Bird Paradise', 'b')] }], activities, 'Singapore')
  assert.equal(day.activities[0].kind, 'offer')
  // The unverified activity falls back to a search card: no price, no product claim
  assert.deepEqual(day.activities[1], { kind: 'search', query: 'Bird Paradise Singapore', label: 'Bird Paradise' })
  for (const entry of day.activities) {
    if (entry.kind === 'search') assert.equal(Object.keys(entry).sort().join(','), 'kind,label,query')
  }
})

test('meals, rest, hotel and transfers are not turned into bookings', () => {
  const titles = ['Lunch at Lau Pa Sat', 'Rest at the hotel', 'Check-in and nap', 'Airport transfer', 'Dinner by the river', 'Free time']
  const [day] = daySuggestions([{ theme: 'Easy day', items: titles.map((title) => item(title)) }], {}, 'Singapore')
  assert.deepEqual(day.activities, [])
})

test('at most three per day, offers first, and the same search is not repeated across days', () => {
  const days = [
    { theme: 'One', items: [item('Gardens by the Bay'), item('ArtScience Museum'), item('Sentosa'), item('Zoo', 'a')] },
    { theme: 'Two', items: [item('Gardens by the Bay'), item('Night Safari')] }
  ]
  const result = daySuggestions(days, { a: activity('a') }, 'Singapore')
  assert.equal(result[0].activities.length, 3)
  assert.equal(result[0].activities[0].kind, 'offer')
  assert.deepEqual(result[1].activities.map((entry) => (entry.kind === 'search' ? entry.label : '')), ['Night Safari'])
})

test('Klook search wording and URL', () => {
  assert.equal(klookQuery('Universal Studios Singapore', 'Singapore'), 'Universal Studios Singapore')
  assert.equal(klookQuery('  Night   Safari ', 'Singapore'), 'Night Safari Singapore')
  assert.equal(klookSearchUrl('en-SG', 'Night Safari Singapore'), 'https://www.klook.com/en-SG/search/result/?query=Night%20Safari%20Singapore')
})

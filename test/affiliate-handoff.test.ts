import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAffiliateLink } from '../src/affiliate/services/affiliate-link'
import { isApprovedPartnerUrl, publicClickMetadata, resolveHandoffUrl } from '../src/shared/utils/partner-url'
import { tripFlightUrl, tripHotelUrl } from '../src/shared/utils/trip-search'

process.env.TRIP_ALLIANCE_ID = 'test-alliance'
process.env.TRIP_SID = 'test-sid'
process.env.KLOOK_AD_ID = 'test-aid'

const once = (url: string, key: string) => new URL(url).searchParams.getAll(key).length

test('Trip.com hotel search keeps the stay and is tagged once', () => {
  const base = tripHotelUrl({
    cityId: 73,
    checkIn: '2026-11-01',
    checkOut: '2026-11-04',
    adults: 2,
    children: 1,
    rooms: 1
  })
  const parsed = new URL(base)
  assert.equal(parsed.pathname, '/hotels/list')
  assert.equal(parsed.searchParams.get('city'), '73')
  assert.equal(parsed.searchParams.get('checkIn'), '2026-11-01')
  assert.equal(parsed.searchParams.get('checkOut'), '2026-11-04')
  assert.equal(parsed.searchParams.get('adult'), '2')

  const tracked = buildAffiliateLink({
    provider: 'trip',
    baseUrl: base,
    context: { placementKey: 'travel_search_hotel', sessionId: 'sess-hotel-1' }
  })
  assert.equal(once(tracked.url, 'Allianceid'), 1)
  assert.equal(once(tracked.url, 'SID'), 1)
  assert.equal(new URL(tracked.url).searchParams.get('city'), '73')
  assert.equal(tracked.subId.includes('@'), false)

  const again = buildAffiliateLink({ provider: 'trip', baseUrl: tracked.url, context: { placementKey: 'travel_search_hotel' } })
  assert.equal(once(again.url, 'Allianceid'), 1)
  assert.equal(once(again.url, 'utm_source'), 1)
})

test('Trip.com flight search keeps the route', () => {
  const base = tripFlightUrl({
    from: 'SIN',
    to: 'BKK',
    departDate: '2026-12-01',
    returnDate: '2026-12-05',
    adults: 2,
    children: 1,
    infants: 0,
    cabin: 'y'
  })
  const parsed = new URL(base)
  assert.equal(parsed.pathname, '/flights/showfarefirst')
  assert.equal(parsed.searchParams.get('dcity'), 'sin')
  assert.equal(parsed.searchParams.get('acity'), 'bkk')
  assert.equal(parsed.searchParams.get('ddate'), '2026-12-01')
  assert.equal(parsed.searchParams.get('rdate'), '2026-12-05')
  assert.equal(parsed.searchParams.get('quantity'), '2')

  const tracked = buildAffiliateLink({
    provider: 'trip.com',
    baseUrl: base,
    context: { placementKey: 'travel_search_flight', sessionId: 'sess-flight-1' }
  })
  assert.equal(once(tracked.url, 'Allianceid'), 1)
  assert.equal(new URL(tracked.url).searchParams.get('acity'), 'bkk')
})

test('Klook destination search keeps the city query and one aid', () => {
  const base = 'https://www.klook.com/en-SG/search/result/?query=Singapore'
  const tracked = buildAffiliateLink({
    provider: 'klook',
    baseUrl: base,
    context: { placementKey: 'klook_destination', sessionId: 'sess-klook-1' }
  })
  const url = new URL(tracked.url)
  assert.equal(url.pathname, '/en-SG/search/result/')
  assert.equal(url.searchParams.get('query'), 'Singapore')
  assert.equal(once(tracked.url, 'aid'), 1)
  assert.equal(url.searchParams.get('aid'), 'test-aid')

  const again = buildAffiliateLink({ provider: 'klook', baseUrl: tracked.url, context: { placementKey: 'klook_destination' } })
  assert.equal(once(again.url, 'aid'), 1)
  assert.equal(once(again.url, 'utm_campaign'), 1)
})

test('Klook activity link keeps the product path', () => {
  const base = 'https://www.klook.com/en-SG/activity/123-universal-studios-singapore/'
  const tracked = buildAffiliateLink({
    provider: 'klook',
    baseUrl: base,
    context: { placementKey: 'trip_planner', offerId: 'offer-1', sessionId: 'sess-activity' }
  })
  assert.equal(new URL(tracked.url).pathname, '/en-SG/activity/123-universal-studios-singapore/')
  assert.equal(once(tracked.url, 'aid'), 1)
  assert.equal(tracked.subId.includes('@'), false)
})

test('an itinerary offer URL is tagged once and hides an email in the session', () => {
  const tracked = buildAffiliateLink({
    provider: 'klook',
    baseUrl: 'https://www.klook.com/en-SG/activity/99-gardens-by-the-bay/',
    context: { placementKey: 'trip_planner', sessionId: 'user@example.com', offerId: 'offer-9' }
  })
  assert.equal(isApprovedPartnerUrl(tracked.url), true)
  assert.equal(once(tracked.url, 'aid'), 1)
  assert.equal(tracked.subId.includes('@'), false)
  assert.equal(tracked.subId.includes('example.com'), false)
})

test('invalid partner URLs are refused and a failed track still hands off', () => {
  assert.equal(isApprovedPartnerUrl('https://evil.com/book'), false)
  assert.equal(isApprovedPartnerUrl('http://www.trip.com/hotels/list'), false)
  assert.equal(isApprovedPartnerUrl('javascript:alert(1)'), false)
  assert.equal(isApprovedPartnerUrl('https://www.trip.com.attacker.com/hotels'), false)
  assert.equal(isApprovedPartnerUrl('https://www.klook.com/en-SG/search/result/?query=Tokyo'), true)
  assert.equal(isApprovedPartnerUrl('https://sg.trip.com/hotels/list?city=73'), true)

  const fallback = 'https://www.klook.com/en-SG/search/result/?query=Singapore&aid=test-aid'
  assert.equal(resolveHandoffUrl(null, fallback), fallback)
  assert.equal(resolveHandoffUrl('https://evil.com/phish', fallback), fallback)
  assert.equal(resolveHandoffUrl(null, 'javascript:alert(1)'), null)
  assert.equal(resolveHandoffUrl(null, '/explore'), '/explore')
})

test('click metadata drops contact details', () => {
  const cleaned = publicClickMetadata({
    destination: 'Singapore',
    searchType: 'activity',
    email: 'guest@example.com',
    phone: '+6590000000',
    search: { type: 'hotel', cityId: 73 }
  })
  assert.equal(cleaned?.destination, 'Singapore')
  assert.equal(cleaned && 'email' in cleaned, false)
  assert.equal(cleaned && 'phone' in cleaned, false)
  assert.deepEqual(cleaned?.search, { type: 'hotel', cityId: 73 })
})

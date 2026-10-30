import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAffiliateLink } from '../src/affiliate/services/affiliate-link'
import { canonicalProductUrl } from '../src/affiliate/services/partner-link-resolver'
import { klookQuery, withMatchedProducts, type DaySuggestions } from '../src/shared/utils/community-booking'

process.env.KLOOK_AD_ID = 'test-aid'

test('Klook product pages are canonicalised without locale or query', () => {
  assert.equal(
    canonicalProductUrl('klook', 'https://www.klook.com/en-SG/activity/2133-gardens-by-the-bay-singapore/?spm=abc#x'),
    'https://www.klook.com/activity/2133-gardens-by-the-bay-singapore/'
  )
  assert.equal(canonicalProductUrl('klook', 'https://klook.com/zh-CN/activity/77'), 'https://www.klook.com/activity/77/')
  assert.equal(canonicalProductUrl('klook', 'https://www.klook.com/vi/event-detail/101-concert/'), 'https://www.klook.com/event-detail/101-concert/')
})

test('search, destination and foreign pages are not products', () => {
  assert.equal(canonicalProductUrl('klook', 'https://www.klook.com/en-SG/search/result/?query=zoo'), null)
  assert.equal(canonicalProductUrl('klook', 'https://www.klook.com/en-SG/destination/c6-singapore/'), null)
  assert.equal(canonicalProductUrl('klook', 'https://evil.example/activity/1-x/'), null)
  assert.equal(canonicalProductUrl('klook', 'https://www.klook.com.evil.example/activity/1-x/'), null)
  assert.equal(canonicalProductUrl('klook', 'http://www.klook.com/activity/1-x/'), null)
  assert.equal(canonicalProductUrl('trip', 'https://www.trip.com/travel-guide/attraction/singapore/zoo-123/'), null)
})

test('Trip.com things-to-do pages are products', () => {
  assert.equal(canonicalProductUrl('trip', 'https://sg.trip.com/things-to-do/detail/36423155/?locale=en-SG'), 'https://www.trip.com/things-to-do/detail/36423155/')
})

test('a resolved Klook product gets the affiliate id at click time', () => {
  const { url } = buildAffiliateLink({ provider: 'klook', baseUrl: 'https://www.klook.com/en-SG/activity/2133-gardens/' })
  const parsed = new URL(url)
  assert.equal(parsed.pathname, '/en-SG/activity/2133-gardens/')
  assert.equal(parsed.searchParams.get('aid'), 'test-aid')
})

test('Klook search wording keeps the bookable place, not the sentence', () => {
  assert.equal(klookQuery("Jacob Ballas Children's Garden at Singapore Botanic Gardens", 'Singapore'), 'Singapore Botanic Gardens')
  assert.equal(klookQuery('Lunch at Lau Pa Sat', 'Singapore'), 'Lau Pa Sat Singapore')
  assert.equal(klookQuery('Morning at Gardens by the Bay (Flower Dome)', 'Singapore'), 'Gardens by the Bay Singapore')
  assert.equal(klookQuery('Day trip: Sentosa Island – beaches and cable car', 'Singapore'), 'Sentosa Island Singapore')
  assert.equal(klookQuery('Explore the S.E.A. Aquarium', 'Singapore'), 'S.E.A. Aquarium Singapore')
})

test('AI matches replace searches, improve keywords, or drop stops with nothing to book', () => {
  const days: DaySuggestions[] = [
    {
      day: 1,
      hotels: null,
      activities: [
        { kind: 'search', query: 'Night Safari Singapore', label: 'Night Safari' },
        { kind: 'search', query: 'Singapore Botanic Gardens', label: "Jacob Ballas Children's Garden at Singapore Botanic Gardens" },
        { kind: 'search', query: 'Lau Pa Sat Singapore', label: 'Lunch at Lau Pa Sat' },
        { kind: 'search', query: 'Bird Paradise Singapore', label: 'Bird Paradise' }
      ]
    }
  ]
  const product = { provider: 'klook' as const, url: 'https://www.klook.com/activity/1-night-safari/', title: 'Night Safari Tickets' }
  const [day] = withMatchedProducts(days, {
    'Night Safari Singapore': { product, search: 'Night Safari' },
    'Singapore Botanic Gardens': { product: null, search: 'Botanic Gardens tour' },
    'Lau Pa Sat Singapore': { product: null, search: null }
  })
  assert.deepEqual(day.activities, [
    { kind: 'search', query: 'Night Safari Singapore', label: 'Night Safari', link: product },
    { kind: 'search', query: 'Singapore Botanic Gardens', label: "Jacob Ballas Children's Garden at Singapore Botanic Gardens", search: 'Botanic Gardens tour' },
    // Lau Pa Sat: nothing on Klook, so no button; Bird Paradise: not looked up yet, keeps its search
    { kind: 'search', query: 'Bird Paradise Singapore', label: 'Bird Paradise' }
  ])
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPublishDraft, childAgeBandsFor, createScrubber } from '../src/community/services/sanitize'
import { handleProblem, normaliseHandle, suggestHandle } from '../src/shared/utils/community-handle'
import type { Itinerary } from '../src/shared/types/trip'

const family = [
  { name: 'Mia', child: true },
  { name: 'Tuan', child: false }
]

test('names become neutral words, with possessives and sentence starts', () => {
  const { scrub, removals } = createScrubber({ people: family, language: 'en' })
  assert.equal(scrub('Mia will love the dolphins.'), 'The kids will love the dolphins.')
  assert.equal(scrub("Pack Mia's hat. Tuan can carry the bag."), "Pack the kids' hat. The grown-ups can carry the bag.")
  assert.deepEqual(removals().names.sort(), ['Mia', 'Tuan'])
})

test('names are matched as whole words only', () => {
  const { scrub } = createScrubber({ people: [{ name: 'Leo', child: true }], language: 'en' })
  assert.equal(scrub('Leopard spotting at the zoo'), 'Leopard spotting at the zoo')
  assert.equal(scrub('Leo, then lunch'), 'The kids, then lunch')
})

test('lowercase words that look like a name are left alone', () => {
  const { scrub } = createScrubber({ people: [{ name: 'Max', child: true }], language: 'en' })
  assert.equal(scrub('Walk for max two hours'), 'Walk for max two hours')
  assert.equal(scrub('Max loves trains'), 'The kids loves trains')
})

test('repeated replacements collapse', () => {
  const { scrub } = createScrubber({ people: [{ name: 'Mia', child: true }, { name: 'Leo', child: true }], language: 'en' })
  assert.equal(scrub('Mia and Leo will enjoy the splash pad'), 'The kids will enjoy the splash pad')
})

test('every word of a full name is removed', () => {
  const { scrub } = createScrubber({ people: [{ name: 'Nguyễn Minh Khoa', child: true }], language: 'vi' })
  assert.equal(scrub('Nguyễn Minh Khoa sẽ thích vườn thú'), 'các bé sẽ thích vườn thú')
  assert.equal(scrub('Khoa nên đội mũ'), 'các bé nên đội mũ')
})

test('Vietnamese diacritics do not break word boundaries', () => {
  const { scrub } = createScrubber({ people: [{ name: 'Đức', child: true }], language: 'vi' })
  assert.equal(scrub('Đức thích bơi'), 'các bé thích bơi')
  assert.equal(scrub('Đứcanh'), 'Đứcanh')
})

test('Chinese names are removed inside running text', () => {
  const { scrub } = createScrubber({ people: [{ name: '小明', child: true }], language: 'zh' })
  assert.equal(scrub('小明会喜欢海洋馆'), '孩子们会喜欢海洋馆')
})

test('short names are reported, not replaced, unless the author asks', () => {
  const people = [{ name: 'An', child: true }]
  const first = createScrubber({ people, language: 'en' })
  assert.equal(first.scrub('An easy morning. An loves the beach.'), 'An easy morning. An loves the beach.')
  assert.deepEqual(first.removals().shortNames, ['An'])

  const second = createScrubber({ people, language: 'en', alsoReplace: ['An'] })
  assert.equal(second.scrub('An loves the beach.'), 'The kids loves the beach.')
  assert.deepEqual(second.removals().shortNames, [])
})

test('emails and phone numbers are removed', () => {
  const { scrub, removals } = createScrubber({ people: [], language: 'en' })
  assert.equal(scrub('Call +65 9123 4567 or mail me@example.com for tips'), 'Call or mail for tips')
  assert.equal(removals().emailsOrPhones, 2)
})

test('child ages become bands; adults are not listed', () => {
  assert.deepEqual(childAgeBandsFor([38, 7, 1, 4, 16, 9]), ['0-2', '3-5', '6-12', '13-17'])
  assert.deepEqual(childAgeBandsFor([40, 41]), [])
})

const itinerary: Itinerary = {
  title: "Mia's Bangkok week",
  summary: 'A gentle trip for Mia and Tuan.',
  days: [
    {
      date: '2027-03-14',
      theme: 'Arrival',
      items: [{ slot: 'morning', activityId: 'offer:abc', title: 'Sea Life', description: 'Mia will love it.', familyTip: 'Go early with Mia.' }]
    },
    { date: '2027-03-15', theme: 'Markets', items: [] }
  ],
  tips: ['Text Tuan at +66 81 234 5678 if lost', '']
}

test('a draft has no names, no dates and no budget', () => {
  const { draft, removals } = buildPublishDraft({
    title: "Mia's Bangkok week",
    destination: 'Bangkok',
    country: 'Thailand',
    startDate: '2027-03-14',
    party: [{ name: 'Tuan', age: 38 }, { name: 'Mia', age: 6 }],
    pace: 'relaxed',
    itinerary,
    language: 'en',
    coverImage: null
  })

  const json = JSON.stringify(draft)
  assert.equal(json.includes('Mia'), false)
  assert.equal(json.includes('Tuan'), false)
  assert.equal(json.includes('2027-03'), false)
  assert.equal(json.includes('5678'), false)
  assert.equal('date' in draft.itinerary.days[0], false)
  assert.equal(draft.title, "The kids' Bangkok week")
  assert.equal(draft.durationDays, 2)
  assert.equal(draft.travelMonth, 3)
  assert.equal(draft.travelStyle, 'relaxed')
  assert.equal(draft.familyFriendly, true)
  assert.deepEqual(draft.childAgeBands, ['6-12'])
  assert.equal(draft.itinerary.days[0].items[0].activityId, 'offer:abc')
  assert.deepEqual(draft.tips, ['Text the grown-ups at if lost'])
  assert.equal(removals.emailsOrPhones, 1)
})

test("the owner's own name is removed too", () => {
  const { draft, removals } = buildPublishDraft({
    title: 'Hanoi trip',
    destination: 'Hanoi',
    country: 'Vietnam',
    startDate: '2027-01-01',
    party: [{ age: 35 }],
    extraNames: ['Vu', 'Dinh'],
    itinerary: { ...itinerary, summary: 'Planned by Vu Dinh. Dinh loves pho.' },
    language: 'en',
    coverImage: null
  })
  assert.equal(draft.description, 'Planned by Vu the grown-ups. The grown-ups loves pho.')
  // "Vu" is too short to replace without the author's say-so
  assert.deepEqual(removals.shortNames, ['Vu'])
})

test('handles: suggested from the first name, never the email', () => {
  assert.match(suggestHandle('Đức Anh', () => 0), /^duc_anh_\d{4}$/)
  assert.match(suggestHandle(null, () => 0.5), /^traveler_\d{4}$/)
  assert.match(suggestHandle('Admin', () => 0), /^traveler_\d{4}$/)
  assert.equal(handleProblem(suggestHandle('Mia')), null)
  assert.equal(handleProblem(normaliseHandle('@Mia_Travels')), null)
  assert.equal(handleProblem('ab'), 'format')
  assert.equal(handleProblem('mia.travels'), 'format')
  assert.equal(handleProblem('gotravelnha_team'), 'reserved')
})

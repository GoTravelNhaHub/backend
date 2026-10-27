import type { Itinerary } from '../../shared/types/trip'
import {
  CHILD_AGE_BANDS,
  TRAVEL_STYLES,
  type ChildAgeBand,
  type PublishDraft,
  type PublishRemovals,
  type PublishedItinerary,
  type TravelStyle
} from '../../shared/types/community'

// Turns a private trip into what may be shown publicly. The planner sends traveller
// names to the model, so plan text can say "Mia will love the aquarium". Names, exact
// dates, budget amounts, emails and phone numbers never reach a published trip.
// Pure functions: no database, so every rule is unit tested (scripts/community-sanitize.test.ts).

export type PlanLanguage = 'en' | 'vi' | 'zh'

export interface NamedPerson {
  name: string
  child: boolean
}

// Neutral words that replace a name, in the language the plan was written in
const REPLACEMENTS: Record<PlanLanguage, { child: string; adult: string; childPossessive: string; adultPossessive: string; and: string[] }> = {
  en: { child: 'the kids', adult: 'the grown-ups', childPossessive: "the kids'", adultPossessive: "the grown-ups'", and: [' and ', ' & ', ', '] },
  vi: { child: 'các bé', adult: 'bố mẹ', childPossessive: 'của các bé', adultPossessive: 'của bố mẹ', and: [' và ', ', '] },
  zh: { child: '孩子们', adult: '大人们', childPossessive: '孩子们的', adultPossessive: '大人们的', and: ['和', '、', ', '] }
}

// Below this length a name is too likely to be an ordinary word ("An", "Bo") to replace automatically.
// Chinese given names are often two characters and are not ordinary words, so they get a lower bar.
const MIN_AUTO_NAME_LENGTH = 3
const MIN_AUTO_HAN_NAME_LENGTH = 2

const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi
// 8+ digits with the separators phone numbers use. Also catches written dates like 2026-03-14.
const PHONE = /\+?\d[\d\s().-]{6,}\d/g
const HAN = /\p{Script=Han}/u

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const capitalise = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1)

/** Name tokens to look for: the full name and each word of it. */
const nameCandidates = (people: NamedPerson[]) => {
  const seen = new Map<string, boolean>()
  for (const person of people) {
    const full = person.name.replace(/\s+/g, ' ').trim()
    if (!full) continue
    for (const token of [full, ...full.split(' ')]) {
      // A word that belongs to an adult and a child counts as a child's, the more careful choice
      if (token) seen.set(token, (seen.get(token) ?? false) || person.child)
    }
  }
  // Longest first, so "Mia Tran" is replaced before "Mia"
  return [...seen.entries()].sort((a, b) => b[0].length - a[0].length).map(([name, child]) => ({ name, child }))
}

/** Matches the name as written and with a capital first letter, as a whole word (any script). */
const nameRegExp = (name: string, language: PlanLanguage) => {
  const variants = [...new Set([name, capitalise(name), name.toLocaleUpperCase()])].map(escapeRegExp).join('|')
  if (HAN.test(name)) return new RegExp(`(?:${variants})`, 'gu')
  const possessive = language === 'en' ? `(?:['’]s)?` : ''
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${variants})${possessive}(?![\\p{L}\\p{N}])`, 'gu')
}

export interface ScrubOptions {
  people: NamedPerson[]
  language: PlanLanguage
  /** Short names the author chose to replace too */
  alsoReplace?: string[]
}

/** One scrubber per trip, so removals are counted across every field. */
export function createScrubber({ people, language, alsoReplace = [] }: ScrubOptions) {
  const words = REPLACEMENTS[language]
  const candidates = nameCandidates(people)
  const forced = new Set(alsoReplace.map((name) => name.trim()).filter(Boolean))
  const longEnough = (name: string) => [...name].length >= (HAN.test(name) ? MIN_AUTO_HAN_NAME_LENGTH : MIN_AUTO_NAME_LENGTH)
  const auto = candidates.filter(({ name }) => longEnough(name) || forced.has(name))
  const short = candidates.filter(({ name }) => !longEnough(name) && !forced.has(name))
  const patterns = auto.map((candidate) => ({ ...candidate, pattern: nameRegExp(candidate.name, language) }))
  const shortPatterns = short.map((candidate) => ({ ...candidate, pattern: nameRegExp(candidate.name, language) }))

  const removedNames = new Set<string>()
  const foundShortNames = new Set<string>()
  let emailsOrPhones = 0

  // "the kids and the kids" -> "the kids"
  const collapseRepeats = (text: string) => {
    let result = text
    for (const term of [words.child, words.adult]) {
      for (const joiner of words.and) {
        const repeated = new RegExp(`${escapeRegExp(term)}(?:${escapeRegExp(joiner)}${escapeRegExp(term)})+`, 'giu')
        result = result.replace(repeated, (match) => (match.charAt(0) === match.charAt(0).toLocaleUpperCase() ? capitalise(term) : term))
      }
    }
    return result
  }

  const scrub = (text: string) => {
    if (!text) return text
    let result = text.replace(EMAIL, () => {
      emailsOrPhones++
      return ''
    })
    result = result.replace(PHONE, () => {
      emailsOrPhones++
      return ''
    })

    for (const { name, child, pattern } of patterns) {
      result = result.replace(pattern, (match, offset: number, whole: string) => {
        removedNames.add(name)
        const possessive = language === 'en' && /['’]s$/.test(match)
        const term = possessive ? (child ? words.childPossessive : words.adultPossessive) : child ? words.child : words.adult
        const before = whole.slice(0, offset)
        const startsSentence = language === 'en' && (/^\s*$/.test(before) || /[.!?]\s+$/.test(before))
        return startsSentence ? capitalise(term) : term
      })
    }

    for (const { name, pattern } of shortPatterns) {
      pattern.lastIndex = 0
      if (pattern.test(result)) foundShortNames.add(name)
    }

    return collapseRepeats(result)
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([,.!?])/g, '$1')
      .trim()
  }

  const removals = (): PublishRemovals => ({
    names: [...removedNames],
    shortNames: [...foundShortNames],
    emailsOrPhones
  })

  return { scrub, removals }
}

export const clip = (value: string | null | undefined, max: number) => (value ? value.trim().slice(0, max) : '')

/** The age bands of the children in a party, in band order. */
export function childAgeBandsFor(ages: number[]): ChildAgeBand[] {
  const bands = new Set<ChildAgeBand>()
  for (const age of ages) {
    if (age < 0 || age >= 18) continue
    bands.add(age <= 2 ? '0-2' : age <= 5 ? '3-5' : age <= 12 ? '6-12' : '13-17')
  }
  return CHILD_AGE_BANDS.filter((band) => bands.has(band))
}

export const MAX_TIPS = 12

/** Strips dates from the days (Day 1..N) and scrubs every text field. Catalogue ids are kept: they are public. */
export function sanitizeItinerary(itinerary: Itinerary, scrub: (text: string) => string): PublishedItinerary {
  return {
    title: clip(scrub(itinerary.title), 120),
    summary: clip(scrub(itinerary.summary), 1000),
    days: itinerary.days.slice(0, 30).map((day) => ({
      theme: clip(scrub(day.theme), 120),
      items: day.items.slice(0, 12).map((item) => ({
        slot: item.slot,
        activityId: item.activityId,
        title: clip(scrub(item.title), 160),
        description: clip(scrub(item.description), 600),
        familyTip: item.familyTip ? clip(scrub(item.familyTip), 300) || null : null
      }))
    })),
    tips: (itinerary.tips || []).map((tip) => clip(scrub(tip), 300)).filter(Boolean).slice(0, MAX_TIPS)
  }
}

export interface DraftInput {
  title: string
  destination: string
  country: string | null
  /** YYYY-MM-DD */
  startDate: string
  party: Array<{ name?: string; age: number }>
  /** Other names to keep out of public text, such as the owner's own */
  extraNames?: string[]
  pace?: string | null
  itinerary: Itinerary
  language: PlanLanguage
  coverImage: string | null
  alsoReplace?: string[]
}

/** The public draft of a trip and what was removed from it. */
export function buildPublishDraft(input: DraftInput): { draft: PublishDraft; removals: PublishRemovals; scrub: (text: string) => string } {
  const people: NamedPerson[] = [
    ...input.party.filter((person) => person.name?.trim()).map((person) => ({ name: person.name!, child: person.age < 18 })),
    ...(input.extraNames || []).filter((name) => name?.trim()).map((name) => ({ name, child: false }))
  ]
  const { scrub, removals } = createScrubber({ people, language: input.language, alsoReplace: input.alsoReplace })

  const itinerary = sanitizeItinerary(input.itinerary, scrub)
  const ages = input.party.map((person) => person.age)
  const childAgeBands = childAgeBandsFor(ages)
  const month = Number(input.startDate.slice(5, 7))
  const travelStyle = TRAVEL_STYLES.includes(input.pace as TravelStyle) ? (input.pace as TravelStyle) : null

  const draft: PublishDraft = {
    title: clip(scrub(input.title), 120) || itinerary.title,
    description: itinerary.summary,
    destination: input.destination,
    country: input.country,
    durationDays: Math.min(Math.max(itinerary.days.length, 1), 30),
    travelMonth: month >= 1 && month <= 12 ? month : 1,
    travelStyle,
    familyFriendly: childAgeBands.length > 0,
    childAgeBands,
    itinerary,
    tips: itinerary.tips,
    coverImage: input.coverImage
  }

  return { draft, removals: removals(), scrub }
}

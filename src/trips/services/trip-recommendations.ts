import { loadCatalogue, resolveActivities, type CatalogueItem } from './trip-catalogue'
import type { RecommendedActivity } from '../../shared/types/trip'

// Ranks supplier-listed activities for a family. Deterministic and free to run: the
// paid model call is reserved for full itineraries. Every result comes from the
// catalogue and carries live price and availability from resolveActivities.

const KID_FRIENDLY = /\b(zoo|aquarium|safari|park|playground|water|splash|kid|kids|children|family|science|museum|theme|garden|farm|cruise|bird|animal|wildlife|adventure|play)\b/i
const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'our', 'like', 'love', 'loves', 'enjoy', 'enjoys', 'not', 'too', 'any', 'some', 'very', 'lots', 'things', 'kids', 'family'])

/**
 * Minimum age from text like "Ages 3+", "Minimum age 7", "18 and above" or "Adults only".
 * Ranges and "under N" are ignored: suppliers use them for ticket price bands
 * ("Child 3-12", "Under 3 free"), not for who may attend.
 */
export function parseMinimumAge(text: string | null): number | null {
  if (!text) return null
  const value = text.toLowerCase()

  if (/adults?\s+only/.test(value)) return 18

  const match =
    value.match(/min(?:imum|\.)?\s*age\s*:?\s*(\d{1,2})/) ||
    value.match(/(\d{1,2})\s*(?:years?|yrs?)?\s*(?:\+|and\s+(?:above|older|over)|&\s*above|or\s+older)/)
  return match ? Number(match[1]) : null
}

const interestTerms = (interests: string | null | undefined) =>
  [
    ...new Set(
      (interests || '')
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
        .map((word) => (word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word))
    )
  ].slice(0, 20)

interface ScoreInput {
  ages: number[]
  interests?: string | null
}

function scoreItem(item: CatalogueItem, rank: number, total: number, input: ScoreInput) {
  const reasons: string[] = []
  const minimumAge = parseMinimumAge(item.ageRestriction)
  const youngest = input.ages.length ? Math.min(...input.ages) : null

  // Hard filter: the youngest traveller is below the supplier's minimum age
  if (youngest !== null && minimumAge !== null && youngest < minimumAge) return null

  // Catalogue order is rating / partner score, so earlier items start slightly ahead
  let score = 1 - rank / Math.max(total, 1)

  if (minimumAge !== null && youngest !== null) reasons.push(`Suits ages ${minimumAge}+`)

  const text = `${item.title} ${item.category || ''} ${item.summary || ''}`.toLowerCase()
  const matched = interestTerms(input.interests).filter((term) => text.includes(term))
  if (matched.length) {
    score += matched.length * 3
    reasons.push(`Matches ${matched.slice(0, 3).join(', ')}`)
  }

  const hasChildren = input.ages.some((age) => age < 13)
  if (hasChildren && KID_FRIENDLY.test(text)) {
    score += 2
    reasons.push('Popular with families')
  }

  return { score, reasons }
}

export interface RecommendOptions extends ScoreInput {
  destination: string
  excludeIds?: string[]
  limit?: number
}

export async function recommendActivities(options: RecommendOptions): Promise<RecommendedActivity[]> {
  const catalogue = await loadCatalogue(options.destination)
  const exclude = new Set(options.excludeIds || [])
  const candidates = catalogue.filter((item) => !exclude.has(item.id))

  const ranked = candidates
    .map((item, index) => {
      const scored = scoreItem(item, index, candidates.length, options)
      return scored ? { item, ...scored } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.score - a.score)
    // Resolve a few extra in case some went unavailable since the catalogue query
    .slice(0, (options.limit ?? 12) + 6)

  const live = await resolveActivities(ranked.map((entry) => entry.item.id))

  return ranked
    .filter((entry) => live[entry.item.id]?.available)
    .slice(0, options.limit ?? 12)
    .map((entry) => ({
      ...live[entry.item.id],
      location: entry.item.location,
      duration: entry.item.duration,
      ageRestriction: entry.item.ageRestriction,
      summary: entry.item.summary,
      reasons: entry.reasons
    }))
}

/** Age in whole years on a given YYYY-MM-DD date. */
export function ageOn(birthDate: Date, onDate: string) {
  const on = new Date(`${onDate}T00:00:00Z`)
  let age = on.getUTCFullYear() - birthDate.getUTCFullYear()
  if (
    on.getUTCMonth() < birthDate.getUTCMonth() ||
    (on.getUTCMonth() === birthDate.getUTCMonth() && on.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1
  }
  return Math.max(age, 0)
}

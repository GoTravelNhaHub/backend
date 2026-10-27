import { randomBytes } from 'crypto'
import { asciiWord } from '../../shared/utils/community-handle'
import { destinationSlug } from '../../shared/utils/destination-slug'

const MAX_WORDS_LENGTH = 60

/** Readable part of a trip URL from its title, cut at a word boundary. Empty for titles with no Latin letters. */
export function titleSlug(title: string) {
  const words = asciiWord(title).split('_').filter(Boolean)
  let slug = ''
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word
    if (next.length > MAX_WORDS_LENGTH) break
    slug = next
  }
  return slug
}

/**
 * "/community/trips/3-days-in-bangkok-with-kids-k7x2m9". The random suffix keeps
 * slugs unique and unguessable from the title alone; it is set once and kept when the title changes.
 */
export function publishedTripSlug(title: string, destination: string, durationDays: number, random = () => randomBytes(4).toString('hex').slice(0, 6)) {
  const words = titleSlug(title) || [`${durationDays}-days`, destinationSlug(destination)].filter(Boolean).join('-')
  return `${words}-${random()}`
}

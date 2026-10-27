// Public handles (/travelers/<handle>). Same rule as the traveler_profiles CHECK constraint.

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/

// Names that could pass for the site or staff
const RESERVED = new Set([
  'admin',
  'administrator',
  'api',
  'community',
  'gotravelnha',
  'gtn',
  'help',
  'mod',
  'moderator',
  'official',
  'root',
  'staff',
  'support',
  'system',
  'team',
  'travelers'
])

export const normaliseHandle = (value: string) => value.trim().replace(/^@/, '').toLowerCase()

export const isReservedHandle = (handle: string) =>
  RESERVED.has(handle) || handle.startsWith('gotravelnha') || handle.startsWith('admin')

/** Null when valid, otherwise why not. */
export const handleProblem = (handle: string): 'format' | 'reserved' | null => {
  if (!HANDLE_PATTERN.test(handle)) return 'format'
  if (isReservedHandle(handle)) return 'reserved'
  return null
}

/** ASCII-only slug part from any name ("Đức Anh" -> "duc_anh"). */
export const asciiWord = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/**
 * A handle to offer a new profile. Built from the first name the user gave, never from
 * their email or login username (which can be the email's local part).
 */
export const suggestHandle = (firstName: string | null | undefined, random: () => number = Math.random) => {
  const base = asciiWord(firstName || '').slice(0, 20)
  const stem = base.length >= 2 && !isReservedHandle(base) ? base : 'traveler'
  const digits = String(Math.floor(random() * 9000) + 1000)
  return `${stem}_${digits}`
}

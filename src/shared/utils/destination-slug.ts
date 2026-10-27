// Destination pages are keyed by city: "Kuala Lumpur, Malaysia" -> "kuala-lumpur"

export const cityOf = (location: string) => location.split(',')[0].trim()

export const destinationSlug = (location: string) =>
  cityOf(location)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const destinationFromSlug = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

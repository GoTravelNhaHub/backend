import prisma from '../../prisma/prisma.client'
import { useRuntimeConfig } from '../../config/runtime-config'

// OpenStreetMap Nominatim. Usage policy: at most one request a second, an identifying
// User-Agent, and results cached. Every lookup (found or not) is stored in PlaceLookup.
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const MIN_GAP_MS = 1100
const TIMEOUT_MS = 8000

export interface Point {
  lat: number
  lon: number
}

export interface Bounds {
  south: number
  west: number
  north: number
  east: number
}

const keyOf = (query: string, city: string) => `${query.trim().toLowerCase()}|${city.trim().toLowerCase()}`.slice(0, 300)

// One request at a time across the process, spaced to the policy
let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0
const throttled = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequestAt = Date.now()
    return task()
  })
  queue = run.catch(() => undefined)
  return run
}

const userAgent = () => {
  const contact = useRuntimeConfig().public?.supportEmail
  return `GoTravelNha/1.0 (https://www.gotravelnha.com${contact ? `; ${contact}` : ''})`
}

async function nominatim(query: string, bounds: Bounds | null): Promise<{ point: Point; label: string } | null> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', 'accept-language': 'en' })
  if (bounds) {
    // viewbox is left,top,right,bottom; bounded keeps results inside the city
    params.set('viewbox', [bounds.west, bounds.north, bounds.east, bounds.south].join(','))
    params.set('bounded', '1')
  }
  const response = await throttled(() =>
    fetch(`${NOMINATIM}?${params}`, { headers: { 'user-agent': userAgent() }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  )
  if (!response.ok) throw new Error(`Nominatim ${response.status}`)
  const [hit] = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>
  if (!hit) return null
  const lat = Number(hit.lat)
  const lon = Number(hit.lon)
  return Number.isFinite(lat) && Number.isFinite(lon) ? { point: { lat, lon }, label: hit.display_name } : null
}

/**
 * Coordinates for a place in a city, from the cache or Nominatim. `bounds` limits the search
 * to the city area so a stop never lands in another country. Network errors are not cached.
 */
export async function geocode(query: string, city: string, bounds: Bounds | null = null): Promise<Point | null> {
  const key = keyOf(query, city)
  const cached = await prisma.placeLookup.findUnique({ where: { key } })
  if (cached) return cached.lat !== null && cached.lon !== null ? { lat: cached.lat, lon: cached.lon } : null

  let hit: Awaited<ReturnType<typeof nominatim>>
  try {
    hit = await nominatim(city && !query.toLowerCase().includes(city.toLowerCase()) ? `${query}, ${city}` : query, bounds)
    // A bounded search with the city appended can miss; try the bare place name inside the box
    if (!hit && bounds && city) hit = await nominatim(query, bounds)
  } catch (error) {
    console.warn('[geocode] lookup failed:', (error as Error).message)
    return null
  }

  const data = { query: query.slice(0, 200), city: city.slice(0, 80), lat: hit?.point.lat ?? null, lon: hit?.point.lon ?? null, label: hit?.label.slice(0, 300) ?? null }
  await prisma.placeLookup.upsert({ where: { key }, create: { key, ...data }, update: data }).catch(() => undefined)
  return hit?.point ?? null
}

/** A box around a point, `km` from the centre in every direction. */
export const boundsAround = (centre: Point, km: number): Bounds => {
  const dLat = km / 111
  const dLon = km / (111 * Math.max(Math.cos((centre.lat * Math.PI) / 180), 0.2))
  return { south: centre.lat - dLat, north: centre.lat + dLat, west: centre.lon - dLon, east: centre.lon + dLon }
}

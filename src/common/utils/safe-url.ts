import { createError } from '../http-error'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const isPrivateAddress = (address: string) => {
  const ip = address.toLowerCase()
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80') || ip.startsWith('::ffff:127.')) return true
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  if (!isIP(v4)) return false
  const [a, b] = v4.split('.').map(Number)
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

/** http(s) URLs that resolve to a public address. Blocks localhost, private networks and link-local metadata addresses. */
export async function assertPublicHttpUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw createError({ statusCode: 400, message: 'A valid http(s) URL is required.' })
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw createError({ statusCode: 400, message: 'Only http and https URLs are allowed.' })
  }
  if (url.username || url.password) {
    throw createError({ statusCode: 400, message: 'URLs with credentials are not allowed.' })
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw createError({ statusCode: 400, message: 'That host is not allowed.' })
  }

  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((entry) => entry.address)
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw createError({ statusCode: 400, message: 'That host is not allowed.' })
  }

  return url.toString()
}

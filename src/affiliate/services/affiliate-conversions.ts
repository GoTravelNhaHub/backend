import type { Prisma } from '@prisma/client'
import prisma from '../../prisma/prisma.client'

// Affiliate commissions reported by partners, joined to our clicks on subId: the
// `subid` parameter server/services/affiliate-link.service.ts adds to outbound links.

export interface ConversionInput {
  provider: string
  subId: string
  orderId: string
  saleAmount?: number | null
  commission?: number | null
  currency?: string | null
  status?: string | null
  occurredAt?: Date | null
  raw?: unknown
}

const STATUSES = new Set(['pending', 'approved', 'rejected'])

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(num) ? num : null
}

/** Normalises loose input (CSV row, query string). Returns an error string if unusable. */
export function parseConversion(row: Record<string, unknown>): ConversionInput | string {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = row[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (typeof value === 'number') return String(value)
    }
    return ''
  }

  const provider = pick('provider').toLowerCase().replace(/\.com$/, '')
  const subId = pick('sub_id', 'subid', 'subId', 'trip_sub1', 'aff_sub')
  const orderId = pick('order_id', 'orderId')
  if (!provider || !subId || !orderId) return 'provider, sub_id and order_id are required'

  const status = pick('status').toLowerCase()
  const dateText = pick('date', 'occurred_at', 'occurredAt')
  const occurredAt = dateText ? new Date(dateText) : null

  return {
    provider: provider.slice(0, 40),
    subId: subId.slice(0, 200),
    orderId: orderId.slice(0, 200),
    saleAmount: toNumber(pick('sale_amount', 'saleAmount')),
    commission: toNumber(pick('commission')),
    currency: pick('currency').toUpperCase().slice(0, 3) || null,
    status: STATUSES.has(status) ? status : status ? null : 'pending',
    occurredAt: occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt : null,
    raw: row
  }
}

/** Inserts or updates by (provider, orderId), so re-imports and repeat postbacks are safe. */
export async function upsertConversion(input: ConversionInput) {
  const data = {
    subId: input.subId,
    saleAmount: input.saleAmount ?? null,
    commission: input.commission ?? null,
    currency: input.currency ?? 'USD',
    status: input.status ?? 'pending',
    occurredAt: input.occurredAt ?? null,
    rawPayload: (input.raw ?? undefined) as Prisma.InputJsonValue | undefined
  }
  const existing = await prisma.affiliateConversionEvent.findUnique({
    where: { provider_orderId: { provider: input.provider, orderId: input.orderId } },
    select: { id: true }
  })
  if (existing) {
    await prisma.affiliateConversionEvent.update({ where: { id: existing.id }, data })
    return 'updated' as const
  }
  await prisma.affiliateConversionEvent.create({ data: { provider: input.provider, orderId: input.orderId, ...data } })
  return 'created' as const
}

/** Minimal CSV parser: header row, comma separated, double-quoted fields. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.some((value) => value.trim())) rows.push(row)

  const [header, ...body] = rows
  if (!header) return []
  const keys = header.map((key) => key.trim().toLowerCase().replace(/\s+/g, '_'))
  return body.map((values) => Object.fromEntries(keys.map((key, index) => [key, (values[index] ?? '').trim()])))
}

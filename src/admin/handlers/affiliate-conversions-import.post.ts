import { type HttpEvent, createError, readBody } from '../../common/http'
import { parseConversion, parseCsv, upsertConversion } from '../../affiliate/services/affiliate-conversions'

const MAX_ROWS = 5000

// Imports a partner commission report (admin-gated by server/middleware/auth-guard.ts).
// CSV columns: provider, sub_id, order_id, sale_amount, commission, currency, status, date
export async function affiliateConversionsImportPost(event: HttpEvent) {
  const body = await readBody(event)
  const csv = typeof body?.csv === 'string' ? body.csv : ''
  if (!csv.trim()) {
    throw createError({ statusCode: 400, message: 'Paste or upload a CSV report.' })
  }

  const rows = parseCsv(csv)
  if (!rows.length) {
    throw createError({ statusCode: 400, message: 'The CSV has no data rows.' })
  }
  if (rows.length > MAX_ROWS) {
    throw createError({ statusCode: 400, message: `Import up to ${MAX_ROWS} rows at a time.` })
  }

  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }
  for (const [index, row] of rows.entries()) {
    const parsed = parseConversion(row)
    if (typeof parsed === 'string') {
      result.skipped += 1
      if (result.errors.length < 20) result.errors.push(`Row ${index + 2}: ${parsed}`)
      continue
    }
    result[(await upsertConversion(parsed)) === 'created' ? 'created' : 'updated'] += 1
  }

  return { success: true, ...result }
}

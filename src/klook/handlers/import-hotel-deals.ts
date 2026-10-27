import { type HttpEvent, createError, readBody } from '../../common/http'
import { requireAdmin } from '../../auth/session'
import pkg from 'papaparse'
const { parse } = pkg
import prisma from '../../prisma/prisma.client'

interface KlookHotelDealRow {
  'Master hotel ID': string
  'Deals category': string
  'Master hotel name': string
  'Star rating': string
  'Currency': string
  'Deal price': string
  'Sell price': string
  'Discount Amount': string
  'URL': string
}

function parseDecimal(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '')
  return parseFloat(cleaned) || 0
}

export async function importHotelDeals(event: HttpEvent) {
  await requireAdmin(event.req)
  try {
    const body = await readBody(event)
    
    if (!body.csvData) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No CSV data provided'
      })
    }

    // Parse CSV
    const parsed = parse<KlookHotelDealRow>(body.csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim()
    })

    if (parsed.errors && parsed.errors.length > 0) {
      console.error('CSV parsing errors:', parsed.errors)
      throw createError({
        statusCode: 400,
        statusMessage: 'CSV parsing failed'
      })
    }

    const rows = parsed.data
    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Process each row
    for (const row of rows) {
      try {
        // Skip if hotel ID is missing
        if (!row['Master hotel ID'] || !row['Master hotel ID'].trim()) {
          results.skipped++
          continue
        }

        const hotelId = row['Master hotel ID'].trim()
        const originalPrice = parseDecimal(row['Sell price'])
        const discountedPrice = parseDecimal(row['Deal price'])
        const savings = parseDecimal(row['Discount Amount'])
        const starRating = parseInt(row['Star rating']) || null
        
        // Calculate savings percentage
        const savingsPercent = originalPrice > 0 
          ? ((savings / originalPrice) * 100).toFixed(2)
          : null

        // Upsert: update if exists, create if not
        await prisma.klookHotelDeal.upsert({
          where: { hotelId },
          update: {
            hotelName: row['Master hotel name'],
            dealCategory: row['Deals category'],
            starRating,
            originalPrice,
            discountedPrice,
            currency: row['Currency'] || 'USD',
            savings,
            savingsPercent: savingsPercent ? parseFloat(savingsPercent) : null,
            affiliateLink: row['URL'],
            isActive: true
          },
          create: {
            hotelId,
            hotelName: row['Master hotel name'],
            dealCategory: row['Deals category'],
            starRating,
            originalPrice,
            discountedPrice,
            currency: row['Currency'] || 'USD',
            savings,
            savingsPercent: savingsPercent ? parseFloat(savingsPercent) : null,
            affiliateLink: row['URL']
          }
        })

        // Check if this was an update or create
        const existing = await prisma.klookHotelDeal.findUnique({
          where: { hotelId }
        })
        
        if (existing && existing.importedAt < new Date(Date.now() - 1000)) {
          results.updated++
        } else {
          results.imported++
        }

      } catch (rowError: any) {
        results.errors.push(`Hotel ID ${row['Master hotel ID']}: ${rowError.message}`)
        results.skipped++
      }
    }

    return {
      success: true,
      results: {
        imported: results.imported,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors,
        totalProcessed: rows.length
      }
    }

  } catch (error: any) {
    console.error('Klook hotel deals import error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Import failed'
    })
  }
}


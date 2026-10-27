import { type HttpEvent, createError, readBody } from '../../common/http'
import { readFile } from 'fs/promises'
import { requireAdmin } from '../../auth/session'
import pkg from 'papaparse'
const { parse } = pkg
import prisma from '../../prisma/prisma.client'

interface KlookPromoCodeRow {
  'Promo code': string
  'Discount description': string
  'Promo code descriptions': string
  'Affiliate descriptions': string
  'Applicable platforms': string
  'Redeem from': string
  'Redeem before': string
  'Valid until': string
  'Time zone': string
  'Terms & Conditions': string
  'Applicable to residents of': string
  'Not applicable to residents of': string
  'Non-applicable activities': string
}

function parseDateTime(dateStr: string): Date {
  // Handle format: 2025-10-01 00:00:00
  const parsed = new Date(dateStr)
  return parsed
}

export async function importPromoCodes(event: HttpEvent) {
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
    const parsed = parse<KlookPromoCodeRow>(body.csvData, {
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
        // Skip if promo code is missing
        if (!row['Promo code'] || !row['Promo code'].trim()) {
          results.skipped++
          continue
        }

        const promoCode = row['Promo code'].trim()
        
        // Parse dates
        const redeemFrom = parseDateTime(row['Redeem from'])
        const redeemBefore = parseDateTime(row['Redeem before'])
        const validUntil = parseDateTime(row['Valid until'])

        // Upsert: update if exists, create if not
        await prisma.klookPromoCode.upsert({
          where: { promoCode },
          update: {
            discountDescription: row['Discount description'],
            promoCodeDescription: row['Promo code descriptions'],
            affiliateDescription: row['Affiliate descriptions'],
            applicablePlatforms: row['Applicable platforms'],
            redeemFrom,
            redeemBefore,
            validUntil,
            timeZone: row['Time zone'],
            termsAndConditions: row['Terms & Conditions'],
            applicableToResidentsOf: row['Applicable to residents of'] || null,
            notApplicableToResidentsOf: row['Not applicable to residents of'] || null,
            nonApplicableActivitiesUrl: row['Non-applicable activities'] || null,
            // Keep isActive as true for manual imports
            isActive: true
          },
          create: {
            promoCode,
            discountDescription: row['Discount description'],
            promoCodeDescription: row['Promo code descriptions'],
            affiliateDescription: row['Affiliate descriptions'],
            applicablePlatforms: row['Applicable platforms'],
            redeemFrom,
            redeemBefore,
            validUntil,
            timeZone: row['Time zone'],
            termsAndConditions: row['Terms & Conditions'],
            applicableToResidentsOf: row['Applicable to residents of'] || null,
            notApplicableToResidentsOf: row['Not applicable to residents of'] || null,
            nonApplicableActivitiesUrl: row['Non-applicable activities'] || null
          }
        })

        // Check if this was an update or create
        const existing = await prisma.klookPromoCode.findUnique({
          where: { promoCode }
        })
        
        if (existing && existing.importedAt < new Date(Date.now() - 1000)) {
          results.updated++
        } else {
          results.imported++
        }

      } catch (rowError: any) {
        results.errors.push(`Promo code ${row['Promo code']}: ${rowError.message}`)
        results.skipped++
      }
    }

    // Auto-deactivate expired codes
    await prisma.klookPromoCode.updateMany({
      where: {
        validUntil: {
          lt: new Date()
        },
        isActive: true
      },
      data: {
        isActive: false
      }
    })

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
    console.error('Klook promo code import error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Import failed'
    })
  }
}


/**
 * Migration Script: Platform-Specific Tables → Unified Event Model
 * 
 * This script migrates data from:
 * - AttractionsgEvent → Event (platform='attractionsg')
 * - KlookActivity → Event (platform='klook')
 * - TripScrapedData → Event (platform='trip')
 * - AttractionsgBooking → EventBooking
 * 
 * Usage:
 *   npx tsx prisma/migrations/migrate_to_unified_event.ts
 * 
 * IMPORTANT: 
 * - Run this in development first to verify
 * - Backup your database before running
 * - Review the migration results before removing old tables
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MigrationStats {
  attractionsg: { migrated: number; errors: number }
  klook: { migrated: number; errors: number }
  trip: { migrated: number; errors: number }
  bookings: { migrated: number; errors: number }
}

async function migrateAttractionsgEvents(): Promise<{ migrated: number; errors: number }> {
  let migrated = 0
  let errors = 0

  console.log('📦 Migrating AttractionsSG events...')

  try {
    const events = await prisma.attractionsgEvent.findMany()

    for (const event of events) {
      try {
        // Check if already migrated
        const existing = await prisma.event.findFirst({
          where: {
            platform: 'attractionsg',
            OR: [
              { link: event.link || undefined },
              { id: event.id }
            ]
          }
        })

        if (existing) {
          console.log(`   ⏭️  Skipping ${event.id} (already exists)`)
          continue
        }

        // Create unified Event record
        await prisma.event.create({
          data: {
            id: event.id, // Preserve original ID
            platform: 'attractionsg',
            title: event.title,
            slug: event.slug,
            description: event.description,
            priceText: event.priceText,
            priceAmount: event.priceAmount,
            resellerPriceAmount: event.resellerPriceAmount,
            originalPriceText: event.originalPriceText,
            originalPriceAmount: event.originalPriceAmount,
            publicPrice: event.publicPrice,
            currency: 'SGD',
            image: event.image,
            location: event.location,
            category: event.category,
            rating: event.rating,
            link: event.link,
            sourceUrl: event.link || null,
            duration: event.duration,
            ageRestriction: event.ageRestriction,
            cancellation: event.cancellation,
            validFrom: event.validFrom,
            validTo: event.validTo,
            lastSeenAt: event.lastSeenAt,
            isActive: event.isActive,
            isPublished: event.isPublished,
            publishedAt: event.publishedAt,
            notes: event.notes,
            isSelfBookable: event.isSelfBookable,
            stripePriceId: event.stripePriceId,
            checkoutNotes: event.checkoutNotes,
            raw: event.raw,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt
          }
        })

        migrated++
        if (migrated % 100 === 0) {
          console.log(`   ✓ Migrated ${migrated} events...`)
        }
      } catch (error: any) {
        console.error(`   ✗ Error migrating AttractionsSG event ${event.id}:`, error.message)
        errors++
      }
    }

    console.log(`   ✅ AttractionsSG: ${migrated} migrated, ${errors} errors`)
  } catch (error: any) {
    console.error('   ✗ Fatal error migrating AttractionsSG events:', error.message)
  }

  return { migrated, errors }
}

async function migrateKlookActivities(): Promise<{ migrated: number; errors: number }> {
  let migrated = 0
  let errors = 0

  console.log('📦 Migrating Klook activities...')

  try {
    const activities = await prisma.klookActivity.findMany()

    for (const activity of activities) {
      try {
        // Check if already migrated
        const existing = await prisma.event.findFirst({
          where: {
            platform: 'klook',
            OR: [
              { link: activity.link || undefined },
              { id: activity.id }
            ]
          }
        })

        if (existing) {
          console.log(`   ⏭️  Skipping ${activity.id} (already exists)`)
          continue
        }

        // Create unified Event record
        await prisma.event.create({
          data: {
            id: activity.id, // Preserve original ID
            platform: 'klook',
            title: activity.title,
            description: activity.description,
            priceAmount: activity.price || null,
            originalPriceAmount: activity.originalPrice || null,
            currency: activity.currency || 'SGD',
            image: activity.image,
            link: activity.link,
            sourceUrl: activity.link || null,
            location: activity.location,
            category: activity.category,
            rating: activity.rating,
            reviewCount: activity.reviewCount,
            metadata: activity.metadata || {},
            lastSeenAt: activity.updatedAt || activity.createdAt,
            isActive: activity.isActive,
            isPublished: false, // Klook activities default to unpublished
            scraperJobId: activity.scraperJobId,
            createdAt: activity.createdAt,
            updatedAt: activity.updatedAt
          }
        })

        migrated++
        if (migrated % 100 === 0) {
          console.log(`   ✓ Migrated ${migrated} activities...`)
        }
      } catch (error: any) {
        console.error(`   ✗ Error migrating Klook activity ${activity.id}:`, error.message)
        errors++
      }
    }

    console.log(`   ✅ Klook: ${migrated} migrated, ${errors} errors`)
  } catch (error: any) {
    console.error('   ✗ Fatal error migrating Klook activities:', error.message)
  }

  return { migrated, errors }
}

async function migrateTripDeals(): Promise<{ migrated: number; errors: number }> {
  let migrated = 0
  let errors = 0

  console.log('📦 Migrating Trip.com deals...')

  try {
    const deals = await prisma.tripScrapedData.findMany()

    for (const deal of deals) {
      try {
        // Check if already migrated
        const existing = await prisma.event.findFirst({
          where: {
            platform: 'trip',
            OR: [
              { link: deal.affiliateLink || undefined },
              { id: deal.id }
            ]
          }
        })

        if (existing) {
          console.log(`   ⏭️  Skipping ${deal.id} (already exists)`)
          continue
        }

        // Create unified Event record
        await prisma.event.create({
          data: {
            id: deal.id, // Preserve original ID
            platform: 'trip',
            title: deal.title,
            description: deal.description,
            originalPriceAmount: deal.originalPrice ? Number(deal.originalPrice) : null,
            discountedPrice: deal.discountedPrice ? (deal.discountedPrice as any) : null,
            discount: deal.discount,
            currency: deal.currency || 'SGD',
            image: deal.image,
            link: deal.affiliateLink,
            sourceUrl: deal.affiliateLink || null,
            location: deal.location,
            dates: deal.dates,
            category: deal.category || 'general',
            metadata: deal.metadata || {},
            lastSeenAt: deal.updatedAt || deal.createdAt,
            isActive: deal.isValid !== false, // Default to true unless explicitly invalid
            isPublished: false, // Trip deals default to unpublished
            scraperJobId: deal.jobId,
            createdAt: deal.createdAt,
            updatedAt: deal.updatedAt
          }
        })

        migrated++
        if (migrated % 100 === 0) {
          console.log(`   ✓ Migrated ${migrated} deals...`)
        }
      } catch (error: any) {
        console.error(`   ✗ Error migrating Trip deal ${deal.id}:`, error.message)
        errors++
      }
    }

    console.log(`   ✅ Trip.com: ${migrated} migrated, ${errors} errors`)
  } catch (error: any) {
    console.error('   ✗ Fatal error migrating Trip.com deals:', error.message)
  }

  return { migrated, errors }
}

async function migrateBookings(): Promise<{ migrated: number; errors: number }> {
  let migrated = 0
  let errors = 0

  console.log('📦 Migrating bookings...')

  try {
    // Check if AttractionsgBooking exists (it might already be migrated to EventBooking)
    const bookings = await (prisma as any).attractionsgBooking?.findMany() || []

    for (const booking of bookings) {
      try {
        // Check if already migrated
        const existing = await prisma.eventBooking.findFirst({
          where: {
            id: booking.id
          }
        })

        if (existing) {
          console.log(`   ⏭️  Skipping ${booking.id} (already exists)`)
          continue
        }

        // Create unified EventBooking record
        await prisma.eventBooking.create({
          data: {
            id: booking.id, // Preserve original ID
            eventId: booking.eventId,
            platform: 'attractionsg',
            eventTitle: booking.eventTitle,
            eventSlug: booking.eventSlug,
            quantity: booking.quantity,
            adultCount: booking.adultCount || 0,
            childCount: booking.childCount || 0,
            amount: booking.amount,
            unitPrice: booking.unitPrice,
            resellerCost: booking.resellerCost,
            stripeFeeAmount: booking.stripeFeeAmount,
            netRevenue: booking.netRevenue,
            currency: booking.currency || 'SGD',
            status: booking.status,
            stripeSessionId: booking.stripeSessionId,
            stripePaymentIntentId: booking.stripePaymentIntentId,
            customerEmail: booking.customerEmail,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            optionCode: booking.optionCode,
            optionName: booking.optionName,
            metadata: booking.metadata,
            notes: booking.notes,
            supplierOrderId: booking.supplierOrderId,
            supplierStatus: booking.supplierStatus,
            supplierPayload: booking.supplierPayload,
            cart: booking.cart,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt
          }
        })

        migrated++
        if (migrated % 100 === 0) {
          console.log(`   ✓ Migrated ${migrated} bookings...`)
        }
      } catch (error: any) {
        console.error(`   ✗ Error migrating booking ${booking.id}:`, error.message)
        errors++
      }
    }

    console.log(`   ✅ Bookings: ${migrated} migrated, ${errors} errors`)
  } catch (error: any) {
    console.log('   ℹ️  No AttractionsgBooking table found (may already be migrated)')
  }

  return { migrated, errors }
}

async function main() {
  console.log('🚀 Starting migration to unified Event model...\n')

  const stats: MigrationStats = {
    attractionsg: { migrated: 0, errors: 0 },
    klook: { migrated: 0, errors: 0 },
    trip: { migrated: 0, errors: 0 },
    bookings: { migrated: 0, errors: 0 }
  }

  // Run migrations
  stats.attractionsg = await migrateAttractionsgEvents()
  stats.klook = await migrateKlookActivities()
  stats.trip = await migrateTripDeals()
  stats.bookings = await migrateBookings()

  // Summary
  console.log('\n📊 Migration Summary:')
  console.log(`   AttractionsSG: ${stats.attractionsg.migrated} migrated, ${stats.attractionsg.errors} errors`)
  console.log(`   Klook: ${stats.klook.migrated} migrated, ${stats.klook.errors} errors`)
  console.log(`   Trip.com: ${stats.trip.migrated} migrated, ${stats.trip.errors} errors`)
  console.log(`   Bookings: ${stats.bookings.migrated} migrated, ${stats.bookings.errors} errors`)

  const totalMigrated = 
    stats.attractionsg.migrated + 
    stats.klook.migrated + 
    stats.trip.migrated + 
    stats.bookings.migrated

  const totalErrors = 
    stats.attractionsg.errors + 
    stats.klook.errors + 
    stats.trip.errors + 
    stats.bookings.errors

  console.log(`\n✅ Total: ${totalMigrated} records migrated, ${totalErrors} errors`)

  if (totalErrors === 0) {
    console.log('\n✨ Migration completed successfully!')
    console.log('\n⚠️  Next steps:')
    console.log('   1. Verify data integrity')
    console.log('   2. Test application with new Event model')
    console.log('   3. Once verified, remove deprecated tables from Prisma schema')
  } else {
    console.log('\n⚠️  Migration completed with errors. Please review before removing old tables.')
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

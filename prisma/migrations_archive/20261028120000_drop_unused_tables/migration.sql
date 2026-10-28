-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_userId_fkey";

-- DropForeignKey
ALTER TABLE "attractionsg_bookings" DROP CONSTRAINT "attractionsg_bookings_eventId_fkey";

-- DropForeignKey
ALTER TABLE "attractionsg_bookings" DROP CONSTRAINT "attractionsg_bookings_userId_fkey";

-- DropForeignKey
ALTER TABLE "scraper_jobs" DROP CONSTRAINT "scraper_jobs_sourceUrl_fkey";

-- DropForeignKey
ALTER TABLE "trip_scraped_data" DROP CONSTRAINT "trip_scraped_data_jobId_fkey";

-- DropTable
DROP TABLE "bookings";

-- DropTable
DROP TABLE "attractionsg_events";

-- DropTable
DROP TABLE "attractionsg_bookings";

-- DropTable
DROP TABLE "price_alerts";

-- DropTable
DROP TABLE "scraper_jobs";

-- DropTable
DROP TABLE "scraper_sources";

-- DropTable
DROP TABLE "trip_scraped_data";

-- DropTable
DROP TABLE "data_comparisons";

-- DropEnum
DROP TYPE "BookingStatus";

-- DropEnum
DROP TYPE "ScraperStatus";


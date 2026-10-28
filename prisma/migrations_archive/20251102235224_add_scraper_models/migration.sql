-- CreateEnum
CREATE TYPE "ScraperStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "scraper_jobs" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" "ScraperStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraper_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_sources" (
    "url" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScrapedAt" TIMESTAMP(3),
    "scrapeCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraper_sources_pkey" PRIMARY KEY ("url")
);

-- CreateTable
CREATE TABLE "trip_scraped_data" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalPrice" DECIMAL(65,30),
    "discountedPrice" DECIMAL(65,30),
    "discount" TEXT,
    "currency" TEXT,
    "image" TEXT,
    "affiliateLink" TEXT,
    "location" TEXT,
    "dates" TEXT,
    "category" TEXT,
    "metadata" JSONB,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "duplicateOf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_scraped_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_comparisons" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform1" TEXT NOT NULL,
    "platform2" TEXT NOT NULL,
    "price1" DECIMAL(65,30) NOT NULL,
    "price2" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "savingsPercent" DECIMAL(65,30),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_scraped_data_jobId_idx" ON "trip_scraped_data"("jobId");

-- CreateIndex
CREATE INDEX "trip_scraped_data_category_idx" ON "trip_scraped_data"("category");

-- CreateIndex
CREATE INDEX "trip_scraped_data_isValid_idx" ON "trip_scraped_data"("isValid");

-- CreateIndex
CREATE INDEX "data_comparisons_title_idx" ON "data_comparisons"("title");

-- AddForeignKey
ALTER TABLE "scraper_jobs" ADD CONSTRAINT "scraper_jobs_sourceUrl_fkey" FOREIGN KEY ("sourceUrl") REFERENCES "scraper_sources"("url") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_scraped_data" ADD CONSTRAINT "trip_scraped_data_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "scraper_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

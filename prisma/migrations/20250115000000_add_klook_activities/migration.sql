-- CreateTable
CREATE TABLE "klook_activities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30),
    "originalPrice" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "image" TEXT,
    "link" TEXT,
    "location" TEXT,
    "rating" DECIMAL(65,30),
    "reviewCount" INTEGER,
    "category" TEXT,
    "metadata" JSONB,
    "scraperJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "klook_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "klook_activities_scraperJobId_idx" ON "klook_activities"("scraperJobId");

-- CreateIndex
CREATE INDEX "klook_activities_category_idx" ON "klook_activities"("category");

-- CreateIndex
CREATE INDEX "klook_activities_location_idx" ON "klook_activities"("location");

-- CreateIndex
CREATE INDEX "klook_activities_isActive_idx" ON "klook_activities"("isActive");

-- CreateIndex
CREATE INDEX "klook_activities_createdAt_idx" ON "klook_activities"("createdAt");

-- AddForeignKey
-- Guard for repositories where scraper models are introduced later in migration history.
DO $$
BEGIN
  IF to_regclass('public.scraper_jobs') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'klook_activities_scraperJobId_fkey'
    ) THEN
    ALTER TABLE "klook_activities"
      ADD CONSTRAINT "klook_activities_scraperJobId_fkey"
      FOREIGN KEY ("scraperJobId") REFERENCES "scraper_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;


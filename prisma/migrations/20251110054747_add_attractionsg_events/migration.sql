-- CreateTable
CREATE TABLE "attractionsg_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "priceText" TEXT,
    "priceAmount" DOUBLE PRECISION,
    "originalPriceText" TEXT,
    "originalPriceAmount" DOUBLE PRECISION,
    "image" TEXT,
    "category" TEXT,
    "location" TEXT,
    "rating" DOUBLE PRECISION,
    "link" TEXT,
    "duration" TEXT,
    "ageRestriction" TEXT,
    "cancellation" TEXT,
    "validFrom" TEXT,
    "validTo" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attractionsg_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attractionsg_events_link_key" ON "attractionsg_events"("link");

-- CreateIndex
CREATE INDEX "attractionsg_events_category_idx" ON "attractionsg_events"("category");

-- CreateIndex
CREATE INDEX "attractionsg_events_isActive_idx" ON "attractionsg_events"("isActive");

-- CreateIndex
CREATE INDEX "attractionsg_events_title_idx" ON "attractionsg_events"("title");

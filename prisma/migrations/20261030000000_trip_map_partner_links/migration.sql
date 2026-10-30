-- CreateTable
CREATE TABLE "trip_map_caches" (
    "tripId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_map_caches_pkey" PRIMARY KEY ("tripId")
);

-- CreateTable
CREATE TABLE "place_lookups" (
    "key" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_lookups_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "partner_links" (
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "search" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_links_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "partner_links_checkedAt_idx" ON "partner_links"("checkedAt");

-- AddForeignKey
ALTER TABLE "trip_map_caches" ADD CONSTRAINT "trip_map_caches_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "published_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;


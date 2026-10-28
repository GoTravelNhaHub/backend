-- CreateTable
CREATE TABLE "affiliate_entities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_offers" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerProductId" TEXT,
    "baseUrl" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "priceAmount" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'SGD',
    "priceText" TEXT,
    "score" DOUBLE PRECISION DEFAULT 0,
    "availabilityStatus" TEXT NOT NULL DEFAULT 'available',
    "lastVerifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_placements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_click_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "entityId" TEXT,
    "offerId" TEXT,
    "provider" TEXT NOT NULL,
    "placementKey" TEXT,
    "placementId" TEXT,
    "pagePath" TEXT,
    "referrer" TEXT,
    "deviceType" TEXT,
    "subId" TEXT,
    "outboundUrl" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_conversion_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subId" TEXT NOT NULL,
    "commission" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_conversion_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_entities_slug_key" ON "affiliate_entities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_placements_key_key" ON "affiliate_placements"("key");

-- CreateIndex
CREATE INDEX "affiliate_entities_status_idx" ON "affiliate_entities"("status");
CREATE INDEX "affiliate_entities_location_idx" ON "affiliate_entities"("location");
CREATE INDEX "affiliate_entities_category_idx" ON "affiliate_entities"("category");

-- CreateIndex
CREATE INDEX "affiliate_offers_entityId_isActive_idx" ON "affiliate_offers"("entityId", "isActive");
CREATE INDEX "affiliate_offers_provider_isActive_idx" ON "affiliate_offers"("provider", "isActive");
CREATE INDEX "affiliate_offers_availabilityStatus_idx" ON "affiliate_offers"("availabilityStatus");
CREATE INDEX "affiliate_offers_lastVerifiedAt_idx" ON "affiliate_offers"("lastVerifiedAt");

-- CreateIndex
CREATE INDEX "affiliate_placements_isActive_idx" ON "affiliate_placements"("isActive");

-- CreateIndex
CREATE INDEX "affiliate_click_events_sessionId_idx" ON "affiliate_click_events"("sessionId");
CREATE INDEX "affiliate_click_events_provider_idx" ON "affiliate_click_events"("provider");
CREATE INDEX "affiliate_click_events_subId_idx" ON "affiliate_click_events"("subId");
CREATE INDEX "affiliate_click_events_entityId_idx" ON "affiliate_click_events"("entityId");
CREATE INDEX "affiliate_click_events_offerId_idx" ON "affiliate_click_events"("offerId");
CREATE INDEX "affiliate_click_events_placementKey_idx" ON "affiliate_click_events"("placementKey");
CREATE INDEX "affiliate_click_events_createdAt_idx" ON "affiliate_click_events"("createdAt");

-- CreateIndex
CREATE INDEX "affiliate_conversion_events_provider_subId_idx" ON "affiliate_conversion_events"("provider", "subId");
CREATE INDEX "affiliate_conversion_events_createdAt_idx" ON "affiliate_conversion_events"("createdAt");

-- AddForeignKey
ALTER TABLE "affiliate_offers" ADD CONSTRAINT "affiliate_offers_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "affiliate_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_click_events" ADD CONSTRAINT "affiliate_click_events_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "affiliate_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_click_events" ADD CONSTRAINT "affiliate_click_events_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "affiliate_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_click_events" ADD CONSTRAINT "affiliate_click_events_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "affiliate_placements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

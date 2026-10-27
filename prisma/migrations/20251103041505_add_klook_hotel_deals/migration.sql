-- CreateTable
CREATE TABLE "klook_hotel_deals" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "dealCategory" TEXT NOT NULL,
    "starRating" INTEGER,
    "originalPrice" DECIMAL(65,30) NOT NULL,
    "discountedPrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "savings" DECIMAL(65,30) NOT NULL,
    "savingsPercent" DECIMAL(65,30),
    "affiliateLink" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "klook_hotel_deals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "klook_hotel_deals_hotelId_key" ON "klook_hotel_deals"("hotelId");

-- CreateIndex
CREATE INDEX "klook_hotel_deals_hotelId_idx" ON "klook_hotel_deals"("hotelId");

-- CreateIndex
CREATE INDEX "klook_hotel_deals_dealCategory_idx" ON "klook_hotel_deals"("dealCategory");

-- CreateIndex
CREATE INDEX "klook_hotel_deals_isActive_idx" ON "klook_hotel_deals"("isActive");

-- CreateIndex
CREATE INDEX "klook_hotel_deals_updatedAt_idx" ON "klook_hotel_deals"("updatedAt");

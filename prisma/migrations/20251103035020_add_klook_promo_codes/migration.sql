-- CreateTable
CREATE TABLE "klook_promo_codes" (
    "id" TEXT NOT NULL,
    "promoCode" TEXT NOT NULL,
    "discountDescription" TEXT NOT NULL,
    "promoCodeDescription" TEXT NOT NULL,
    "affiliateDescription" TEXT NOT NULL,
    "applicablePlatforms" TEXT NOT NULL,
    "redeemFrom" TIMESTAMP(3) NOT NULL,
    "redeemBefore" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "termsAndConditions" TEXT NOT NULL,
    "applicableToResidentsOf" TEXT,
    "notApplicableToResidentsOf" TEXT,
    "nonApplicableActivitiesUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "klook_promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "klook_promo_codes_promoCode_key" ON "klook_promo_codes"("promoCode");

-- CreateIndex
CREATE INDEX "klook_promo_codes_promoCode_idx" ON "klook_promo_codes"("promoCode");

-- CreateIndex
CREATE INDEX "klook_promo_codes_isActive_idx" ON "klook_promo_codes"("isActive");

-- CreateIndex
CREATE INDEX "klook_promo_codes_validUntil_idx" ON "klook_promo_codes"("validUntil");

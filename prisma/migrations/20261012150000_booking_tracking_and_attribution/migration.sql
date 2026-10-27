-- Booking references, order tracking, ticket delivery, idempotent post-payment
-- steps, discounts and acquisition data on self-checkout bookings
ALTER TABLE "attractionsg_bookings"
ADD COLUMN "reference" TEXT,
ADD COLUMN "userId" TEXT,
ADD COLUMN "voucherUrl" TEXT,
ADD COLUMN "voucherNote" TEXT,
ADD COLUMN "opsNotifiedAt" TIMESTAMP(3),
ADD COLUMN "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN "ticketSentAt" TIMESTAMP(3),
ADD COLUMN "discountAmount" DOUBLE PRECISION,
ADD COLUMN "sessionId" TEXT,
ADD COLUMN "attribution" JSONB;

-- Existing bookings get a reference derived from their id
UPDATE "attractionsg_bookings"
SET "reference" = 'GTN-' || upper(substr(md5("id"), 1, 8))
WHERE "reference" IS NULL;

-- Bookings that were already paid and handled must not get emails again on a retry
UPDATE "attractionsg_bookings"
SET "opsNotifiedAt" = COALESCE("paidAt", "updatedAt"),
    "confirmationSentAt" = COALESCE("paidAt", "updatedAt")
WHERE "status" IN ('PAID', 'REFUNDED');

CREATE UNIQUE INDEX "attractionsg_bookings_reference_key" ON "attractionsg_bookings"("reference");
CREATE INDEX "attractionsg_bookings_userId_idx" ON "attractionsg_bookings"("userId");
CREATE INDEX "attractionsg_bookings_sessionId_idx" ON "attractionsg_bookings"("sessionId");

ALTER TABLE "attractionsg_bookings" ADD CONSTRAINT "attractionsg_bookings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Affiliate conversions: partner order id for idempotent imports, sale amount and status
ALTER TABLE "affiliate_conversion_events"
ADD COLUMN "orderId" TEXT,
ADD COLUMN "saleAmount" DOUBLE PRECISION,
ADD COLUMN "status" TEXT,
ADD COLUMN "occurredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "affiliate_conversion_events_provider_orderId_key"
  ON "affiliate_conversion_events"("provider", "orderId");

-- Track payment time and refunds on self-checkout bookings
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

ALTER TABLE "attractionsg_bookings"
ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "refundedAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "attractionsg_bookings_supplierStatus_idx"
  ON "attractionsg_bookings"("supplierStatus");

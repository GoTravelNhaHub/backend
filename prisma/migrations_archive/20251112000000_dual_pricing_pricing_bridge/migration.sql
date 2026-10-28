CREATE TABLE IF NOT EXISTS "_prisma_migrations" (id SERIAL PRIMARY KEY);
-- Alter attractions events
ALTER TABLE "attractionsg_events"
  ADD COLUMN IF NOT EXISTS "resellerPriceAmount" DOUBLE PRECISION;

-- Alter bookings table for pricing breakdown and supplier tracking
ALTER TABLE "attractionsg_bookings"
  ADD COLUMN IF NOT EXISTS "resellerCost" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "stripeFeeAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "netRevenue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "supplierOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierPayload" JSONB;

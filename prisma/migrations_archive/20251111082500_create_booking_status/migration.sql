-- Create BookingStatus enum if not existing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN
    CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
  END IF;
END
$$;

-- Ensure bookings table exists and has proper enum column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attractionsg_bookings'
  ) THEN
    CREATE TABLE "attractionsg_bookings" (
      "id" TEXT NOT NULL,
      "eventId" TEXT NOT NULL,
      "eventTitle" TEXT NOT NULL,
      "eventSlug" TEXT,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "amount" DOUBLE PRECISION NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'SGD',
      "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
      "stripeSessionId" TEXT NOT NULL,
      "stripePaymentIntentId" TEXT,
      "customerEmail" TEXT,
      "customerName" TEXT,
      "customerPhone" TEXT,
      "optionCode" TEXT,
      "optionName" TEXT,
      "metadata" JSONB,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "attractionsg_bookings_pkey" PRIMARY KEY ("id")
    );
  ELSE
    -- Ensure status column uses the enum type
    ALTER TABLE "attractionsg_bookings"
    ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE "attractionsg_bookings"
    ALTER COLUMN "status" TYPE "BookingStatus"
    USING (
      CASE
        WHEN "status" IN ('PENDING','PAID','FAILED','CANCELLED')
          THEN "status"::"BookingStatus"
        ELSE 'PENDING'::"BookingStatus"
      END
    );

    ALTER TABLE "attractionsg_bookings"
    ALTER COLUMN "status" SET DEFAULT 'PENDING'::"BookingStatus";
  END IF;
END
$$;

-- Ensure required columns exist on attractionsg_events
ALTER TABLE "attractionsg_events"
ADD COLUMN IF NOT EXISTS "isSelfBookable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT,
ADD COLUMN IF NOT EXISTS "checkoutNotes" TEXT;

-- Ensure indexes and FK
CREATE UNIQUE INDEX IF NOT EXISTS "attractionsg_bookings_stripeSessionId_key"
  ON "attractionsg_bookings"("stripeSessionId");

CREATE INDEX IF NOT EXISTS "attractionsg_bookings_eventId_idx"
  ON "attractionsg_bookings"("eventId");

CREATE INDEX IF NOT EXISTS "attractionsg_bookings_status_idx"
  ON "attractionsg_bookings"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attractionsg_bookings_eventId_fkey'
  ) THEN
    ALTER TABLE "attractionsg_bookings"
    ADD CONSTRAINT "attractionsg_bookings_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "attractionsg_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;


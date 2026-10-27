-- Ensure attractionsg_events has self booking columns
ALTER TABLE "attractionsg_events"
ADD COLUMN IF NOT EXISTS "isSelfBookable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT,
ADD COLUMN IF NOT EXISTS "checkoutNotes" TEXT;

-- Create BookingStatus enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'BookingStatus'
  ) THEN
    CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
  END IF;
END
$$;

-- Create bookings table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attractionsg_bookings'
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
  END IF;
END
$$;

-- Ensure status column uses enum type
DO $$
DECLARE
  status_udt TEXT;
BEGIN
  SELECT udt_name INTO status_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'attractionsg_bookings'
    AND column_name = 'status';

  IF status_udt = 'text' THEN
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

-- Ensure default is set correctly if column already exists
ALTER TABLE "attractionsg_bookings"
ALTER COLUMN "status" SET DEFAULT 'PENDING'::"BookingStatus";

-- Ensure indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS "attractionsg_bookings_stripeSessionId_key"
  ON "attractionsg_bookings"("stripeSessionId");

CREATE INDEX IF NOT EXISTS "attractionsg_bookings_eventId_idx"
  ON "attractionsg_bookings"("eventId");

CREATE INDEX IF NOT EXISTS "attractionsg_bookings_status_idx"
  ON "attractionsg_bookings"("status");

-- Ensure foreign key exists
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


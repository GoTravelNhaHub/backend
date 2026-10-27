/* =====================================================================================
   events_use_uuid (id: 20251112110000)

   Convert AttractionsgEvent primary key from TEXT to UUID and migrate existing data.
   Also updates AttractionsgBooking.eventId to reference the new UUID primary key.
   ===================================================================================== */

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Add temporary UUID columns
ALTER TABLE "attractionsg_events"
ADD COLUMN IF NOT EXISTS "new_id" UUID DEFAULT gen_random_uuid();

UPDATE "attractionsg_events"
SET "new_id" = gen_random_uuid()
WHERE "new_id" IS NULL;

ALTER TABLE "attractionsg_bookings"
ADD COLUMN IF NOT EXISTS "new_event_id" UUID;

UPDATE "attractionsg_bookings" AS b
SET "new_event_id" = e."new_id"
FROM "attractionsg_events" AS e
WHERE b."eventId" = e."id";

DELETE FROM "attractionsg_bookings"
WHERE "new_event_id" IS NULL;

-- 2. Drop existing foreign keys and indexes referencing the old eventId
ALTER TABLE "attractionsg_bookings"
DROP CONSTRAINT IF EXISTS "attractionsg_bookings_eventId_fkey";

DROP INDEX IF EXISTS "attractionsg_bookings_eventId_idx";

-- 3. Replace the primary key on attractionsg_events
ALTER TABLE "attractionsg_events"
DROP CONSTRAINT IF EXISTS "attractionsg_events_pkey";

ALTER TABLE "attractionsg_events"
DROP COLUMN "id";

ALTER TABLE "attractionsg_events"
RENAME COLUMN "new_id" TO "id";

ALTER TABLE "attractionsg_events"
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "attractionsg_events"
ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE "attractionsg_events"
ADD CONSTRAINT "attractionsg_events_pkey" PRIMARY KEY ("id");

-- 4. Swap booking eventId column to the new UUID values
ALTER TABLE "attractionsg_bookings"
DROP COLUMN "eventId";

ALTER TABLE "attractionsg_bookings"
RENAME COLUMN "new_event_id" TO "eventId";

ALTER TABLE "attractionsg_bookings"
ALTER COLUMN "eventId" SET NOT NULL;

-- 5. Recreate index and foreign key with UUID reference
CREATE INDEX "attractionsg_bookings_eventId_idx"
  ON "attractionsg_bookings"("eventId");

ALTER TABLE "attractionsg_bookings"
ADD CONSTRAINT "attractionsg_bookings_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "attractionsg_events"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

